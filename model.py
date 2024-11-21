from mesa import Model
from mesa.time import RandomActivation
from mesa.space import MultiGrid
from agent import *
import json
from collections import deque
import pprint

class CityModel(Model):
    """ 
        Creates a model based on a city map.

        Args:
            N: Number of agents in the simulation
    """
    mapData = {
    
        ">" : "right",
        "<" : "left",
        "S" : 15,
        "s" : 7,
        "#" : "Obstacle",
        "v" : "down",
        "^" : "up",
        "D" : "Destination"
    }

    checkData = {
        ">": {
            "infront": {
                "pos": (1,0),
                "expected": ">"
                },
            "sides": [
                {"pos": (0,-1),
                "expected": "^"
                }, 
                {"pos": (0,1),
                "expected": "v"
                }, 
        ]},
        "^": {
            "infront": {
                "pos": (0,-1),
                "expected": "^"
                },
            "sides": [
                {"pos": (1,0),
                "expected": ">"
                }, 
                {"pos": (-1,0),
                "expected": "<"
                }, 
        ]},
        "<": {
            "infront": {
                "pos": (-1,0),
                "expected": "<"
                },
            "sides":[
                {"pos": (0,-1),
                "expected": "^"
                }, 
                {"pos": (0,1),
                "expected": "v"
                }, 
        ]},
         "v":{
            "infront": {
                "pos": (0,1),
                "expected": "v"
                },
            "sides": [
                {"pos": (-1,0),
                "expected": "<"
                }, 
                {"pos": (1,0),
                "expected": ">"
                }, 
        ]},
    }

    trafficLightDirection = [
        {
            "pos": (1,0),
            "expected": "<",
        },
        {
            "pos": (-1,0),
            "expected": ">"
        },
        {
            "pos": (0,-1),
            "expected": "^"
        },
        {
            "pos": (0,1),
            "expected": "v"
        },
        ]
    
    directionsDecodeDict = {
        "^": (0,1),
        "v": (0,-1),
        "<": (-1,0),
        ">": (1,0),
    }
    
    sideCheck = {
        "^": 
        [
            {
            "pos": (-1,0),
            "allowed": "<^D"
            },
            {
            "pos": (1,0),
            "allowed": ">^D"
            },
        ],
        "v": 
        [
            {
            "pos": (-1,0),
            "allowed": "<vD"
            },
            {
            "pos": (1,0),
            "allowed": ">vDD"
            },
        ],
        "<": 
        [
            {
            "pos": (0,-1),
            "allowed": "<vD"
            },
            {
            "pos": (0,1),
            "allowed": "<^D"
            },
        ],
        ">": 
        [
            {
            "pos": (0,-1),
            "allowed": ">vD"
            },
            {
            "pos": (0,1),
            "allowed": ">^D"
            },
        ]
    }


    def __init__(self, Density):

        # Load the map dictionary. The dictionary maps the characters in the map file to the corresponding agent.
        super().__init__()
        
        self.density = Density
        self.traffic_lights = []
        self.destinations = []
        self.unique_id = 0
        # Load the map file. The map file is a text file where each character represents an agent.
        with open('./2022_base.txt') as baseFile:
            lines = baseFile.readlines()
            self.width = len(lines[0])-1
            self.height = len(lines)

        self.grid = MultiGrid(self.width, self.height, torus = False) 
        self.schedule = RandomActivation(self)
        # Goes through each character in the map file and creates the corresponding agent.
        self.starting_positions = [(x,y) for x in [0,self.width-1] for y in [0,self.height-1]]
        
        self.graph = {}
        graphCreated = False

        for r, row in enumerate(lines):
            for c, col in enumerate(row):
                if col in ["v", "^", ">", "<"]:
                    # agent = Road((c, self.height - r - 1), self, [CityModel.mapData[col]])
                    # self.grid.place_agent(agent, (c, self.height - r - 1))

                    if (not graphCreated):
                        p =  (c, self.height - r - 1)
                        self.createGraph(lines, (c, self.height - r - 1))
                        graphCreated = True
                    
                    # for neighbor in CityModel.checkData[col]["sides"]:
                    #     (x,y) = neighbor["pos"]
                    #     infront = CityModel.checkData[col]["infront"]
                        
                    #     if c + x >= 0 and c + x < self.width and r + y >= 0 and r + y < self.height and neighbor["expected"] == lines[r + y][c + x] and infront["expected"] == lines[r + infront["pos"][1]][c +  infront["pos"][0]]:
                    #         #print("FOUND at:", r,c)
                    #         # print("Current pos:", c,r)
                    #         # print("Value:", col)
                    #         # print("Checked:",  c + x, r + y )
                    #         # print("Val there", lines[r + y][c + x] )
                    #         agent.directions.append(neighbor["expected"])
                    #         #check = False


                elif col in ["S", "s"]:
                    agent = Traffic_Light(f"tl_{r*self.width+c}", self, False if col == "S" else True, int(CityModel.mapData[col]))
                    self.grid.place_agent(agent, (c, self.height - r - 1))
                    self.schedule.add(agent)
                    self.traffic_lights.append(agent)
                    road_agent = None

                    # for direction in CityModel.trafficLightDirection:
                    #     if lines[r + direction["pos"][1]][c + direction["pos"][0]] == direction["expected"]:
                    #         road_agent = Road((c, self.height - r - 1), self, [CityModel.mapData[direction["expected"]]])
                    #         break
                    
                    # self.grid.place_agent(road_agent, (c, self.height - r - 1))

                elif col == "#":
                    agent = Obstacle(f"ob_{r*self.width+c}", self)
                    self.grid.place_agent(agent, (c, self.height - r - 1))

                elif col == "D":
                    agent = Destination(f"d_{r*self.width+c}", self)
                    self.grid.place_agent(agent, (c, self.height - r - 1))
                    self.destinations.append((c, self.height - r - 1))

        # print(self.destinations)

        # pos = (1,9)
        # car = Car(1, self, pos) 
        # self.schedule.add(car)
        # self.grid.place_agent(car, pos)

        # self.num_agents = N
        self.running = True

    def step(self):
        '''Advance the model by one step.'''

        for pos in self.starting_positions:
            val = self.random.randrange(100)
            if val <= self.density * 100:
                car = Car(self.unique_id, self, pos) 
                self.unique_id += 1
                self.schedule.add(car)
                self.grid.place_agent(car, pos)

        self.schedule.step()

    def getRandomDest(self):
        return self.random.choice(self.destinations)
    

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
                return direction["expected"]
               


    def createGraph(self, lines, start):

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
            

            for side in CityModel.sideCheck[curDirection]:
                x = cur[0] + side["pos"][0] 
                y = cur[1] + side["pos"][1]

                if (x < 0 or x >= self.width) or (y < 0 or y >= self.height):
                    continue
                if lines[self.height - y - 1][x] in side["allowed"]:
                    self.graph[cur].append((x,y))
                    if (x,y) not in visited:
                        visited.add((x,y))
                        queue.append((x,y))


        print("function ended")
        # pprint.pprint(self.graph)
        return
