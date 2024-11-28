from agent import *
from model import CityModel
from mesa.visualization import CanvasGrid, BarChartModule, PieChartModule
from mesa.visualization import ModularServer
import mesa
import random

def random_color():
    """Generate a random hex color string in the format #RRGGBB."""
    return "#{:06x}".format(random.randint(0, 0xFFFFFF))

def agent_portrayal(agent):
    if agent is None: return
    
    portrayal = {
                 "Filled": "true",
                 
                 }

    if (isinstance(agent, Road)):
        #print(direction)
        pos = agent.position
        portrayal["Color"] = "gray"
        if pos in agent.model.schedule.danger_squares:
            portrayal["Color"] = "black"
        elif pos in agent.model.schedule.pre_danger_squares:
             portrayal["Color"] = "white"
        portrayal["Shape"] = "rect"
        portrayal["Layer"] = 0
        portrayal["w"] = 0.8
        portrayal["h"] = 0.8
    

    elif (isinstance(agent, Destination)):
        portrayal["Color"] = "lightgreen"
        portrayal["Layer"] = 0
        portrayal["w"] = 0.8
        portrayal["h"] = 0.8
        portrayal["Shape"] = "rect"
        

    elif (isinstance(agent, Traffic_Light)):
        portrayal["Color"] = "red" if not agent.go else "green"
        portrayal["Layer"] = 1
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
        dir = agent.directionWritten
        if dir == "down":
            portrayal["Color"] = "red"
        elif dir == "up":
            portrayal["Color"] = "blue"
        elif dir == "right":
            portrayal["Color"] = "green"
        elif dir == "left":
            portrayal["Color"] = "purple"

       
        portrayal["text"] = agent.unique_id
        portrayal["text_color"] = "Black"
        portrayal["Shape"] = "circle"
        portrayal["Layer"] = 2
        portrayal["r"] = 0.8
        
    return portrayal

width = 0
height = 0

with open('./2023_base.txt') as baseFile:
    lines = baseFile.readlines()
    width = len(lines[0])-1
    height = len(lines)


steps_dist_max = 150
model_params = { 
    "width": width,
    "height": height,
    "lines": lines,
    "steps_dist_max": steps_dist_max
                }  

active_chart_element = mesa.visualization.ChartModule(
    [
        {"Label": "ActiveCars", "Color": "#000066"},
       
    ]
)

arrived_chart_element = mesa.visualization.ChartModule(
    [
        {"Label": "Arrived", "Color": "#FF8000"},
       
    ]
)


steps_bar_chart = BarChartModule(
    [{"Label": str(i), "Color": random_color()} for i in range(1, steps_dist_max + 1)], 
    data_collector_name="datacollector"
)

memo_pie_chart = PieChartModule(
    [
        {"Label": "Memoization", "Color": "blue"},
        {"Label": "No Memoization", "Color": "red"}
    ]
)

#print(width, height)
grid = CanvasGrid(agent_portrayal, width, height, 500, 500)



server = ModularServer(CityModel, [grid, active_chart_element, arrived_chart_element, steps_bar_chart, memo_pie_chart], "Traffic Base", model_params)
                       
server.port = 8521 # The default
server.launch()