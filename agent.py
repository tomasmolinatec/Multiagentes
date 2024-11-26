from mesa import Agent
from collections import deque
import pprint
import copy

class Car(Agent):
    
    possibleLaneChange = {
        (0,1): [(-1,1), (1,1)],
        (0,-1): [(-1,-1), (1,-1)],
        (1,0): [(1,1), (1,-1)],
        (-1,0): [(-1,1), (-1,-1)],
    }
    directionsDecode = {
         (0,1): "up",
        (0,-1): "down",
        (1,0): "right",
        (-1,0): "left",
    }
    def __init__(self, unique_id, model, pos):
        """
        Creates a new agent with a position and model.
        Args:
            unique_id: The agent's ID
            model: Model reference for the agent
            pos: Position of the agent (tuple)
        """
        super().__init__(unique_id, model)  # Call the Agent constructor
        
        self.originalPosition = pos  # Set position
        self.position = pos 
        self.timeStopped = 0
        self.destination = self.model.getRandomDest()
        # print("D:",self.destination)
        self.route = self.GetRoute(self.position)
        self.routeIndex = 0
        self.model.activeCars += 1
        self.stepCount = 0
        self.direction = 0
        self.directionWritten = ""
       

    def GetRoute(self, start):
        """
        Encuentra el camino más corto a una estación de carga usando búsqueda en anchura (BFS).
        Retorna:
            path: Lista de celdas que llevan a la estación de carga más cercana
        """
        key = str(start) + str(self.destination)
        print(key)
        if key in self.model.memo:
            print("Used memoization!")
            self.model.memoCount += 1
            # print("Original Pos:", self.originalPosition)
            # print("Cur Pos:",self.position)
            # print("Destination:",self.destination)
            # print(self.model.memo[key])
            return self.model.memo[key]

        print("Didnt use memoization!")
        self.model.noMemoCount += 1
        q  = deque([(start,[])])  # Cola para BFS con la posición actual y el camino recorrido
        visited = {start}  # Mantiene registro de las celdas visitadas

        while q:
            cur, path = q.popleft()  # Toma el primer elemento de la cola
            if cur == self.destination:
                self.model.memo[key] =  copy.deepcopy(path)
                return path 
            
            if cur not in self.model.graph:
                continue
            possible_moves = self.model.graph[cur]

            for move in possible_moves:
                if move not in visited:
                    visited.add(move)  # Marca la celda como visitada
                    q.append((move, path + [move]))  # Añade la celda y el camino actualizado a la cola
            
    
    def canChangeLane(self):

        if self.direction in Car.possibleLaneChange:
            relatives_directions = Car.possibleLaneChange[self.direction]
        else:
            return False

        for cell in relatives_directions:
            to_move = (self.position[0] + cell[0], self.position[1] + cell[1])
            if to_move[0] >= 0 and to_move[0] < self.model.width and to_move[1] >= 0 and to_move[1] < self.model.height  and self.isEmpty(to_move):
                self.ChangeRoute(to_move)
                # print(self.route)
                return True
       
        return False

    
    def isEmpty(self, pos):
        agents = self.model.grid.get_cell_list_contents([pos])
        # Define a set of agent classes that are considered "not empty"
        blocked_agents = {Car, Obstacle, Traffic_Light, Destination}

        # Check if any agent is of the blocked type
        return not any(isinstance(a, agent_type) for a in agents for agent_type in blocked_agents)

    def ChangeRoute(self,  next_move):

        print(next_move, self.GetRoute(next_move))
        self.route = [next_move] + self.GetRoute(next_move)
        self.routeIndex = 0
        # self.route[0] = next_mov




    def move(self):
       
        if self.position == self.destination:
            # print("GOT THERE")
            self.model.grid.remove_agent(self)
            self.model.schedule.remove(self)
            self.model.activeCars -= 1
            self.model.addStepCount(self.stepCount)
            return
        

        next_move = self.route[self.routeIndex]

        self.direction = (next_move[0] - self.position[0], next_move[1]- self.position[1])
        if self.direction in Car.directionsDecode:
            self.directionWritten =  Car.directionsDecode[self.direction] 

        
        canMove = True

        for agent in self.model.grid.get_cell_list_contents([next_move]):
            if isinstance(agent, Car) :
                if len(self.route) > 0  and self.timeStopped >= 1 and self.canChangeLane() :
                    next_move = self.route[self.routeIndex]
                else: 
                    canMove = False
            elif isinstance(agent, Traffic_Light) and not agent.go:
                canMove =  False
            
        if canMove:
            self.model.grid.move_agent(self, next_move)
            self.position = next_move
            self.routeIndex += 1
            self.timeStopped = 0
        else:
            self.timeStopped += 1

   


    def step(self):
        """ 
        Determines the new direction it will take, and then moves
        """
        self.move()
        self.stepCount += 1

class Traffic_Light(Agent):
    """
    Traffic light. Where the traffic lights are in the grid.
    """
    def __init__(self, unique_id, model, red, green, start):
        super().__init__(unique_id, model)
        """
        Creates a new Traffic light.
        Args:
            unique_id: The agent's ID
            model: Model reference for the agent
            state: Whether the traffic light is green or red
            timeToChange: After how many step should the traffic light change color 
        """
        self.direction = ""
        self.red = red
        self.green = green
        self.total = red + green
        self.go = False if start < red else True
        self.cur = start

    def step(self):
        """ 
        To change the state (green or red) of the traffic light in case you consider the time to change of each traffic light.
        """
        self.cur += 1
        if not self.go:
            if self.cur >= self.red:
                self.cur = 0
                self.go = True
        else:
            if self.cur >= self.green:
                self.cur = 0
                self.go = False

       

        
            
        

class Destination(Agent):
    """
    Destination agent. Where each car should go.
    """
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model)

    def step(self):
        pass

class Obstacle(Agent):
    """
    Obstacle agent. Just to add obstacles to the grid.
    """
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model)

    def step(self):
        pass

class Road(Agent):
    """
    Road agent. Determines where the cars can move, and in which direction.
    """
    def __init__(self, pos, model, direction):
        """
        Creates a new road.
        Args:
            unique_id: The agent's ID
            model: Model reference for the agent
            direction: Direction where the cars can move
        """
        super().__init__(pos,  model)
        self.direction = direction
       

