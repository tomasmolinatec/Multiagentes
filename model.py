from mesa import Model
from mesa.time import RandomActivation
from mesa.space import MultiGrid
from agent import *
import json
from collections import deque
import pprint
import mesa


class CityModel(Model):
    """
    Creates a model based on a city map.

    Args:
        N: Number of agents in the simulation
    """

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

    def __init__(self, width, height, lines, steps_dist_max):

        # Load the map dictionary. The dictionary maps the characters in the map file to the corresponding agent.
        super().__init__()

        self.destinations = []
        self.unique_id = 0
        self.width = width
        self.height = height
        self.grid = MultiGrid(self.width, self.height, torus=False)
        self.schedule = RandomActivation(self)
        self.activeCars = 0
        self.memoCount = 0
        self.noMemoCount = 0

        self.steps_distribution_lambda = {}
        self.steps_distribution = {}

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
            }
        )

        # Goes through each character in the map file and creates the corresponding agent.
        self.starting_positions = [
            (x, y) for x in [1, self.width - 1] for y in [1, self.height - 1]
        ]

        self.graph = {}
        self.memo = {}
        graphCreated = False
        self.TLDirections = {}
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

                    if not graphCreated:
                        p = (c, self.height - r - 1)
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
                    red = 7
                    green = 6
                    start = 0 if col == "S" else 6
                    agent = Traffic_Light(
                        f"tl_{r*self.width+c}", self, red, green, start
                    )
                    self.grid.place_agent(agent, (c, self.height - r - 1))
                    self.schedule.add(agent)

                elif col == "#":
                    agent = Obstacle(f"ob_{r*self.width+c}", self)
                    self.grid.place_agent(agent, (c, self.height - r - 1))

                elif col == "D":
                    agent = Destination(f"d_{r*self.width+c}", self)
                    self.grid.place_agent(agent, (c, self.height - r - 1))
                    self.destinations.append((c, self.height - r - 1))

        for pos, dir in self.TLDirections.items():
            TL = self.grid.get_cell_list_contents([pos])[0]
            TL.direction = dir
            agent = Road(self.unique_id, self, (pos[0], pos[1]), dir)
            self.unique_id += 1
            self.grid.place_agent(agent, (pos[0], pos[1]))

        self.running = True

    def step(self):
        """Advance the model by one step."""
        # pprint.pprint(self.memo)

        self.schedule.step()
        self.datacollector.collect(self)
        added = True

        if self.schedule.steps % 2 == 0:
            added = False
            for pos in self.starting_positions:
                if self.hasNoCars(pos):
                    car = Car(self.unique_id, self, pos)
                    self.unique_id += 1
                    self.schedule.add(car)
                    self.grid.place_agent(car, pos)
                    added = True

        if not added:
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
                    self.graph[cur].append((x, y))
                    if (x, y) not in visited:
                        visited.add((x, y))
                        queue.append((x, y))

        # print("function ended")
        # pprint.pprint(self.graph)
        return
