from mesa.time import BaseScheduler
from agent import Car
import pprint
from collections import deque

class CautionScheduler(BaseScheduler):
    def __init__(self, model):
        super().__init__(model)
        self.traffic_lights = []
        self.cars = []


        self.danger_squares = set()  
        self.pre_danger_squares = set()  

        self.danger_squares_info = {}

        w = self.model.width
        h = self.model.height
        graph = self.model.graph
        # Solo funciona si son dos carriles en los lados
        for i in range(2, h-2):
            left_col_pos = (1, i)
            if left_col_pos in graph:
                next = (2, i)
                if next in graph[left_col_pos]:
                    self.danger_squares.add(left_col_pos)
                    points = graph[left_col_pos][0]

                    self.danger_squares_info[left_col_pos] = {
                        "direction":  ((points[0] - left_col_pos[0]) , (points[1] - left_col_pos[1])),
                        "turn": (1,0)
                        }

        #     right_col_pos = (w-2, i)
        #     if right_col_pos in graph:
        #         next = (w-3, i)
        #         if next in graph[right_col_pos]:
        #             self.danger_squares.add(right_col_pos)
        #             points = graph[right_col_pos][0]

        #             self.danger_squares_info[right_col_pos] = {
        #                 "direction":  ((points[0] - right_col_pos[0]) , (points[1] - right_col_pos[1])),
        #                 "turn": (-1,0)
        #                 }

        
        # for i in range(2, w-2):
        #     bot_row_pos = (i, 1)
        #     if bot_row_pos in graph:
        #         next = (i, 2)
        #         if next in graph[bot_row_pos]:
        #             self.danger_squares.add(bot_row_pos)
        #             points = graph[bot_row_pos][0]

        #             self.danger_squares_info[bot_row_pos] = {
        #                 "direction":  ((points[0] - bot_row_pos[0]) , (points[1] - bot_row_pos[1])),
        #                 "turn": (0,1)
        #                 }
        #     top_row_pos = (i, h-2)
        #     if top_row_pos in graph:
        #         next = (i, h-3)
        #         if next in graph[top_row_pos]:
        #             self.danger_squares.add(top_row_pos)
        #             points = graph[top_row_pos][0]

        #             self.danger_squares_info[top_row_pos] = {
        #                 "direction":  ((points[0] - top_row_pos[0]) , (points[1] - top_row_pos[1])),
        #                 "turn": (0,-1)
        #                 }

        
        for square in self.danger_squares:
            dir = self.danger_squares_info[square]["direction"]
            inv_dir = (dir[0] *-1, dir[1]*-1)
            pre_danger = (square[0] + inv_dir[0],square[1] + inv_dir[1])
            if pre_danger not in self.danger_squares:
                self.pre_danger_squares.add(pre_danger)


        # print("Danger squares:",self.danger_squares)
        # print("PreDanger squares:", self.pre_danger_squares)
        # pprint.pprint(self.danger_squares_info)
            

         

    def add_traffic_lights(self, traffic_lights):
        """Add an agent to the group that will be activated first."""
        self.traffic_lights += traffic_lights

    def add_car(self, agent):
        """Add an agent to the group that will be activated last."""
        self.cars.append(agent)

    def remove_car(self, agent):
        self.cars.remove(agent)

    def step(self):
        """Advance each agent in the custom order."""
        # Activate agents in the first group
        print(len(self.cars))
        for agent in self.traffic_lights:
            agent.step()


        self.activated_cars = set()
        pre_danger_agents = []
        for square in self.danger_squares:
            agents = self.model.grid.get_cell_list_contents([square])
            for agent in agents:
                if isinstance(agent, Car):
                    # Checar coches enfrente y activalos antes
                    self.activateFront(square)
                    self.activateTurn(square)

                    agent.step()
                    self.activated_cars.add(agent)
       
        for agent in self.cars:
            if agent not in self.activated_cars:
                if agent.position in self.pre_danger_squares:
                    pre_danger_agents.append(agent)
                else:
                    agent.step()

        for agent in pre_danger_agents:
            agent.step()

        self.steps += 1
        self.time += 1


    def activateFront(self, square):
        direction = self.danger_squares_info[square]["direction"]
        step = 1
        cars = deque([])
        
        while True:
            hasCar = False
            pos_to_check = (square[0] + direction[0] * step, square[1] + direction[1] * step)
            if pos_to_check[0] < 0 or pos_to_check[0] >= self.model.width or pos_to_check[1] < 0 or pos_to_check[1] >= self.model.height:
                break

            agents = self.model.grid.get_cell_list_contents([pos_to_check])
            for agent in agents:
                if isinstance(agent, Car):
                    cars.appendleft(agent)
                    hasCar = True
                    step += 1
            if not hasCar:
                break

        while cars:
            a = cars.popleft()
            a.step()
            self.activated_cars.add(a)

        while cars:
            a = cars.popleft()
            a.step()
            self.activated_cars.add(a)


    def activateTurn(self, square):
        direction = self.danger_squares_info[square]["turn"]
        step = 1
        cars = deque([])
    
        while True:
            hasCar = False
            pos_to_check = (square[0] + direction[0] * step, square[1] + direction[1] * step)
            if pos_to_check[0] < 0 or pos_to_check[0] >= self.model.width or pos_to_check[1] < 0 or pos_to_check[1] >= self.model.height:
                break

            agents = self.model.grid.get_cell_list_contents([pos_to_check])
            for agent in agents:
                if isinstance(agent, Car):
                    cars.appendleft(agent)
                    hasCar = True
                    step += 1
            if not hasCar:
                break

        while cars:
            a = cars.popleft()
            a.step()
            self.activated_cars.add(a)



