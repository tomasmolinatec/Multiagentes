from mesa import Model
from mesa.time import RandomActivation, BaseScheduler
from mesa.space import MultiGrid
from agent import *
import json
from collections import deque
import pprint
import mesa
from CautionScheduler import CautionScheduler 
import requests


class CityModel(Model):
    #  Atributos de clase

    mapData = {
        ">": "right",
        "<": "left",
        "S": 15,
        "s": 7,
        "#": "Obstacle",
        "v": "down",
        "^": "up",
        "D": "Destination",
    }

    trafficLightDirection = [
        {
            "pos": (1, 0),
            "expected": "<",
        },
        {"pos": (-1, 0), "expected": ">"},
        {"pos": (0, -1), "expected": "^"},
        {"pos": (0, 1), "expected": "v"},
    ]

    directionsDecodeDict = {
        "^": (0, 1),
        "v": (0, -1),
        "<": (-1, 0),
        ">": (1, 0),
    }

    sideCheck = {
        "^": [
            {"pos": (-1, 0), "allowed": "<^D"},
            {"pos": (1, 0), "allowed": ">^D"},
        ],
        "v": [
            {"pos": (-1, 0), "allowed": "<vD"},
            {"pos": (1, 0), "allowed": ">vDD"},
        ],
        "<": [
            {"pos": (0, -1), "allowed": "<vD"},
            {"pos": (0, 1), "allowed": "<^D"},
        ],
        ">": [
            {"pos": (0, -1), "allowed": ">vD"},
            {"pos": (0, 1), "allowed": ">^D"},
        ],
    }

    def __init__(self, width, height, lines, steps_dist_max): #Recibimos el mapa como parametros del servidor

       
        super().__init__()

        # Atributos
        self.destinations = []
        self.unique_id = 0
        self.width = width
        self.height = height
        self.grid = MultiGrid(self.width, self.height, torus=False)
        # self.schedule = BaseScheduler(self)
        self.activeCars = 0
        self.memoCount = 0
        self.noMemoCount = 0
        self.arrived = 0

        self.steps_distribution_lambda = {}
        self.steps_distribution = {}

        # Logica de gráfica de distribucion
        for i in range(1, steps_dist_max):
            self.steps_distribution[i] = 0
            self.steps_distribution_lambda[str(i)] = (
                lambda m, i=i: self.steps_distribution[i]
            )

        self.datacollector = mesa.DataCollector(
            self.steps_distribution_lambda
            | {
                "ActiveCars": lambda m: self.activeCars,
                "Memoization": lambda m: self.memoCount,
                "No Memoization": lambda m: self.noMemoCount,
                "Arrived": lambda m: self.arrived
            }
        )

        # Las esquinas, donde se agregan coches
        self.starting_positions = [
            (x, y) for x in [0, self.width - 1] for y in [0, self.height - 1]
        ]

        self.graph = {}
        self.memo = {}
        graphCreated = False
        self.TLDirections = {}
        traffic_lights = []
        for r, row in enumerate(lines):
            for c, col in enumerate(row):
                if col in ["v", "^", ">", "<"]:
                    agent = Road(
                        self.unique_id,
                        self,
                        (c, self.height - r - 1),
                        CityModel.mapData[col],
                    )
                    self.unique_id += 1
                    self.grid.place_agent(agent, (c, self.height - r - 1))

                    if not graphCreated: #Creamos el grafo al encontrar el primer Road en el mapa
                        p = (c, self.height - r - 1)
                        self.createGraph(lines, (c, self.height - r - 1))
                        graphCreated = True


                elif col in ["S", "s"]: # Semáforos
                    cycle = 7
                    
                    start = True if col == "S" else False
                    agent = Traffic_Light(
                        f"tl_{r*self.width+c}", self, start, cycle
                    )
                    self.grid.place_agent(agent, (c, self.height - r - 1))
                    # self.schedule.add(agent)
                    traffic_lights.append(agent)

                elif col == "#":
                    agent = Obstacle(f"ob_{r*self.width+c}", self)
                    self.grid.place_agent(agent, (c, self.height - r - 1))

                elif col == "D":
                    agent = Destination(f"d_{r*self.width+c}", self)
                    self.grid.place_agent(agent, (c, self.height - r - 1))
                    self.destinations.append((c, self.height - r - 1))


        for pos, dir in self.TLDirections.items(): 
            # Creamos los semáforos, son creados aqui porque la direccion que tienen es calculada al crear el grafo
            # Tambien creamos un Road agent ahi para la visualizacion en webgl
            TL = self.grid.get_cell_list_contents([pos])[0]
            TL.direction = dir
            agent = Road(self.unique_id, self, (pos[0], pos[1]), dir)
            self.unique_id += 1
            self.grid.place_agent(agent, (pos[0], pos[1]))

        # Crear nuestro sheduler
        self.schedule = CautionScheduler(self)
        self.schedule.add_traffic_lights(traffic_lights)

        self.running = True
        self.url = "http://10.49.12.55:5000/api/"
        self.endpoint = "validate_attempt"
        for pos in self.starting_positions: #Crear coches iniciales
                car = Car(self.unique_id, self, pos)
                self.unique_id += 1
                self.schedule.add_car(car)
                self.grid.place_agent(car, pos)
    

    def step(self):
        """Advance the model by one step."""
        # pprint.pprint(self.memo)

        self.schedule.step()
        self.datacollector.collect(self)
        added = True
        
        # Agregamos coches
        if self.schedule.steps % 1 == 0:
            added = False
            for pos in self.starting_positions:
                if self.hasNoCars(pos):
                    car = Car(self.unique_id, self, pos)
                    self.unique_id += 1
                    self.schedule.add_car(car)
                    self.grid.place_agent(car, pos)
                    added = True
        # if self.schedule.steps % 10 == 0:
            #  self.postStats()

        if not added: #Parar si no se logro agregar mas coches
            print("stop")
            self.running = False

        # with open("data.json", "w") as json_file:
        #     json.dump(self.memo, json_file, indent=4)

    def getRandomDest(self):
        return self.random.choice(self.destinations)

    def hasNoCars(self, pos):
        agents = self.grid.get_cell_list_contents(pos)

        for a in agents:
            if isinstance(a, Car):
                return False
        return True

    def addStepCount(self, steps):

        if steps in self.steps_distribution:
            self.steps_distribution[steps] += 1

    def directionsDecode(self, cur, lines):

        val = lines[self.height - cur[1] - 1][cur[0]]
        if val in "<>^vD":
            return val

        for direction in CityModel.trafficLightDirection:

            x = cur[0] + direction["pos"][0]
            y = cur[1] + direction["pos"][1]

            if (x < 0 or x >= self.width) or (y < 0 or y >= self.height):
                continue

            if lines[self.height - y - 1][x] == direction["expected"]:
                self.TLDirections[cur] = CityModel.mapData[direction["expected"]]
                return direction["expected"]

    def createGraph(self, lines, start):
        # Crear el grafo(dict de adyacencia) usando BFS

        queue = deque([start])
        visited = {start}

        while queue:
            cur = queue.popleft()

            curDirection = self.directionsDecode(cur, lines)
            if curDirection == "D":
                continue
            relative_pos = CityModel.directionsDecodeDict[curDirection]

            next = (cur[0] + relative_pos[0], cur[1] + relative_pos[1])

            self.graph[cur] = [next]

            if next not in visited:
                visited.add(next)
                queue.append(next)

            for side in CityModel.sideCheck[curDirection]: # Checar los lados, para cambios de carril, vueltas y destinos
                x = cur[0] + side["pos"][0]
                y = cur[1] + side["pos"][1]

                if (x < 0 or x >= self.width) or (y < 0 or y >= self.height):
                    continue
                if lines[self.height - y - 1][x] in side["allowed"]:
                    self.graph[cur].append((x, y))
                    if (x, y) not in visited:
                        visited.add((x, y))
                        queue.append((x, y))

        # print("function ended")
        # pprint.pprint(self.graph)
        return
    
    def postStats(self):
        #Para el concurso
       

        data = {
            "year" : 2024,
            "classroom" : 301,
            "name" : "LeTom y Diego Curry",
            "current_cars": self.activeCars,
            "total_arrived": self.arrived,
            # "steps": self.schedule.steps 
        }

        headers = {
            "Content-Type": "application/json"
        }
        
        response = requests.post(self.url+self.endpoint, data=json.dumps(data), headers=headers)

        # print("Request " + "successful" if response.status_code == 200 else "failed", "Status code:", response.status_code)
        # print("Response:", response.json())
