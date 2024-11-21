from mesa import Agent
from collections import deque

class Car(Agent):
    
    directionsDecode = {
        "up": (0,1),
        "down": (0,-1),
        "right": (1,0),
        "left": (-1,0),
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
        self.pos = pos  # Set position
        print(f"Agent position: {self.pos}")
        self.destination = self.model.getRandomDest()
        print("D:",self.destination)
        self.route = self.GetRoute()
        print(self.route)

    def GetRoute(self):
        """
        Encuentra el camino más corto a una estación de carga usando búsqueda en anchura (BFS).
        Retorna:
            path: Lista de celdas que llevan a la estación de carga más cercana
        """
       
        q  = deque([(self.pos,[])])  # Cola para BFS con la posición actual y el camino recorrido
        visited = {self.pos}  # Mantiene registro de las celdas visitadas

        while q:
            cur, path = q.popleft()  # Toma el primer elemento de la cola
            if cur == self.destination:
                return path  # Retorna el camino si encuentra una estación de carga

            
            # Consigue solo las celdas que conoce el Roomba
            if cur not in self.model.graph:
                continue
            possible_moves = self.model.graph[cur]

            for move in possible_moves:
                if move not in visited:
                    visited.add(move)  # Marca la celda como visitada
                    q.append((move, path + [move]))  # Añade la celda y el camino actualizado a la cola


    def move(self):
        if not self.route:
            self.model.grid.remove_agent(self)
            self.model.schedule.remove(self)
            return
        
        next_move = self.route.pop(0)

        for agent in self.model.grid.get_cell_list_contents([next_move]):
            if isinstance(agent, Car):
                return
            
        self.model.grid.move_agent(self, next_move)



    def step(self):
        """ 
        Determines the new direction it will take, and then moves
        """
        self.move()

class Traffic_Light(Agent):
    """
    Traffic light. Where the traffic lights are in the grid.
    """
    def __init__(self, unique_id, model, state = False, timeToChange = 10):
        super().__init__(unique_id, model)
        """
        Creates a new Traffic light.
        Args:
            unique_id: The agent's ID
            model: Model reference for the agent
            state: Whether the traffic light is green or red
            timeToChange: After how many step should the traffic light change color 
        """
        self.state = state
        self.timeToChange = timeToChange

    def step(self):
        """ 
        To change the state (green or red) of the traffic light in case you consider the time to change of each traffic light.
        """
        if self.model.schedule.steps % self.timeToChange == 0:
            self.state = not self.state

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
        self.directions = direction
       

    def getDirections(self):
       return self.directions
