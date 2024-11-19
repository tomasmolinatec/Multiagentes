from mesa import Model
from mesa.time import RandomActivation
from mesa.space import MultiGrid
from agent import *
import json

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
            "pos": (0,1),
            "expected": "^"
        },
        {
            "pos": (0,-1),
            "expected": "v"
        },
        ]
    
    def __init__(self, N):

        # Load the map dictionary. The dictionary maps the characters in the map file to the corresponding agent.
        super().__init__()

        self.traffic_lights = []
        self.destinations = []
        # Load the map file. The map file is a text file where each character represents an agent.
        with open('./2022_base.txt') as baseFile:
            lines = baseFile.readlines()
            self.width = len(lines[0])-1
            self.height = len(lines)

            self.grid = MultiGrid(self.width, self.height, torus = False) 
            self.schedule = RandomActivation(self)
            # Goes through each character in the map file and creates the corresponding agent.

            for r, row in enumerate(lines):
                for c, col in enumerate(row):
                    if col in ["v", "^", ">", "<"]:
                        agent = Road((c, self.height - r - 1), self, [CityModel.mapData[col]])
                        self.grid.place_agent(agent, (c, self.height - r - 1))
                       
                        for neighbor in CityModel.checkData[col]["sides"]:
                            (x,y) = neighbor["pos"]
                            infront = CityModel.checkData[col]["infront"]
                            
                            if c + x >= 0 and c + x < self.width and r + y >= 0 and r + y < self.height and neighbor["expected"] == lines[r + y][c + x] and infront["expected"] == lines[r + infront["pos"][1]][c +  infront["pos"][0]]:
                                #print("FOUND at:", r,c)
                                # print("Current pos:", c,r)
                                # print("Value:", col)
                                # print("Checked:",  c + x, r + y )
                                # print("Val there", lines[r + y][c + x] )
                                agent.directions.append(neighbor["expected"])
                                #check = False


                    elif col in ["S", "s"]:
                        agent = Traffic_Light(f"tl_{r*self.width+c}", self, False if col == "S" else True, int(CityModel.mapData[col]))
                        self.grid.place_agent(agent, (c, self.height - r - 1))
                        self.schedule.add(agent)
                        self.traffic_lights.append(agent)
                        road_agent = None

                        for direction in CityModel.trafficLightDirection:
                            if lines[r + direction["pos"][1]][c + direction["pos"][0]] == direction["expected"]:
                                road_agent = Road((c, self.height - r - 1), self, [CityModel.mapData[direction["expected"]]])
                                break
                        
                        self.grid.place_agent(road_agent, (c, self.height - r - 1))

                    elif col == "#":
                        agent = Obstacle(f"ob_{r*self.width+c}", self)
                        self.grid.place_agent(agent, (c, self.height - r - 1))

                    elif col == "D":
                        agent = Destination(f"d_{r*self.width+c}", self)
                        self.grid.place_agent(agent, (c, self.height - r - 1))
                        self.destinations.append((c, self.height - r - 1))

        # print(self.destinations)

        pos = (0,10)
        car = Car(
             pos, self) 
        self.schedule.add(car)
        self.grid.place_agent(car, pos)

        self.num_agents = N
        self.running = True

    def step(self):
        '''Advance the model by one step.'''
        self.schedule.step()

    def getRandomDest(self):
        return self.random.choice(self.destinations)