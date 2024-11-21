from agent import *
from model import CityModel
from mesa.visualization import CanvasGrid, BarChartModule
from mesa.visualization import ModularServer
import mesa

def agent_portrayal(agent):
    if agent is None: return
    
    portrayal = {
                 "Filled": "true",
                 
                 }

    if (isinstance(agent, Road)):
        directions = agent.getDirections()
        #print(direction)
        if len(directions) > 1:
            portrayal["Color"] = "purple"
            portrayal["Shape"] = "rect"
        else:
            portrayal["Shape"] = "resources/"+directions[0].lower()+".png"
        portrayal["Layer"] = 1
        portrayal["w"] = 0.8
        portrayal["h"] = 0.8
    

    elif (isinstance(agent, Destination)):
        portrayal["Color"] = "lightgreen"
        portrayal["Layer"] = 0
        portrayal["w"] = 0.8
        portrayal["h"] = 0.8
        portrayal["Shape"] = "rect"
        

    elif (isinstance(agent, Traffic_Light)):
        portrayal["Color"] = "red" if not agent.state else "green"
        portrayal["Layer"] = 0
        portrayal["w"] = 0.8
        portrayal["h"] = 0.8
        portrayal["Shape"] = "rect"

    elif (isinstance(agent, Obstacle)):
        portrayal["Color"] = "cadetblue"
        portrayal["Layer"] = 0
        portrayal["w"] = 0.8
        portrayal["h"] = 0.8
        portrayal["Shape"] = "rect"

    if (isinstance(agent, Car)):
        portrayal["Color"] = "black"
        portrayal["Shape"] = "circle"
        portrayal["Layer"] = 0
        portrayal["r"] = 0.8
        
    return portrayal

width = 0
height = 0

with open('./2022_base.txt') as baseFile:
    lines = baseFile.readlines()
    width = len(lines[0])-1
    height = len(lines)

model_params = { "Density": mesa.visualization.Slider("Density", 0.3, 0, 1, 0.05),}  

#print(width, height)
grid = CanvasGrid(agent_portrayal, width, height, 500, 500)

server = ModularServer(CityModel, [grid], "Traffic Base", model_params)
                       
server.port = 8521 # The default
server.launch()