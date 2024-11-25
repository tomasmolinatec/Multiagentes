from mesa import Agent
from collections import deque

class Car(Agent):
    
    possibleLaneChange = {
        (0,1): [(-1,1), (1,1)],
        (0,-1): [(-1,-1), (1,-1)],
        (1,0): [(1,1), (1,-1)],
        (-1,0): [(-1,1), (-1,-1)],
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
        self.position = pos  # Set position
        self.timeStopped = 0
        self.destination = self.model.getRandomDest()
        # print("D:",self.destination)
        self.route = self.GetRoute(self.position)
        # print(self.route)

    def GetRoute(self, start):
        """
        Encuentra el camino más corto a una estación de carga usando búsqueda en anchura (BFS).
        Retorna:
            path: Lista de celdas que llevan a la estación de carga más cercana
        """
        key = str(start) + str(self.destination)

        if key in self.model.memo:
            print("Used memoization!")
            print(self.model.memo)
            return self.model.memo[key]

        q  = deque([(start,[])])  # Cola para BFS con la posición actual y el camino recorrido
        visited = {start}  # Mantiene registro de las celdas visitadas

        while q:
            cur, path = q.popleft()  # Toma el primer elemento de la cola
            if cur == self.destination:
                self.model.memo[key] = path
                return path  # Retorna el camino si encuentra una estación de carga
            
            if cur not in self.model.graph:
                continue
            possible_moves = self.model.graph[cur]

            for move in possible_moves:
                if move not in visited:
                    visited.add(move)  # Marca la celda como visitada
                    q.append((move, path + [move]))  # Añade la celda y el camino actualizado a la cola
            


    def canChangeLane(self):
        
        direction = (self.route[0][0]- self.position[0], self.route[0][1]- self.position[1])

        if direction in Car.possibleLaneChange:
            relatives_directions = Car.possibleLaneChange[direction]
        else:
            return False

        for cell in relatives_directions:
            to_move = (self.position[0] + cell[0], self.position[1] + cell[1])
            if to_move[0] >= 0 and to_move[0] < self.model.width and to_move[1] >= 0 and to_move[1] < self.model.height  and self.model.grid.is_cell_empty(to_move):
                self.ChangeRoute(direction, to_move)
                # print(self.route)
                return True
        return False

       
    def ChangeRoute(self, direction, next_move):

        # print("\n")    
        # print(direction)
        # print("pos", self.position)
        # print(self.route)

        new_route = [next_move]
        for i in range(1,len(self.route)):
            if (self.route[i][0] - self.route[i-1][0], self.route[i][1]- self.route[i-1][1]) == direction:
               
               new_move = ( new_route[i - 1][0] + direction[0], new_route[i - 1][1] + direction[1])
               new_route.append(new_move)
            else:
                # print("Found change:")
                # print("i:",self.route[i])
                # print("i-1:",self.route[i-1])
                # print((self.route[i][0] - self.route[i-1][0], self.route[i][1]- self.route[i-1][1]))
                # print(self.route[i])
                new_route += self.route[i:]
                # print("New route", new_route)
                self.route = new_route
                return 


        # self.route[0] = next_move




    def move(self):
        if self.position == self.destination:
            self.model.grid.remove_agent(self)
            self.model.schedule.remove(self)
            return
        

        next_move = self.route[0]
        while next_move == self.position:
            self.route.pop(0)
            next_move = self.route[0]
        
        canMove = True

        for agent in self.model.grid.get_cell_list_contents([next_move]):
            if isinstance(agent, Car) :
                if self.timeStopped >= 1 and self.canChangeLane() :
                    canMove = True
                else: 
                    canMove = False
            if isinstance(agent, Traffic_Light) and not agent.go:
                canMove =  False
            
        if canMove:
            self.model.grid.move_agent(self, next_move)
            self.position = self.route.pop(0)
            self.timeStopped = 0
        else:
            self.timeStopped += 1

        # if self.timeStopped > 8:
        #     print("\n\nPosition:",self.position)
        #     print(self.route)


    def step(self):
        """ 
        Determines the new direction it will take, and then moves
        """
        self.move()

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
        self.directions = direction
       

    def getDirections(self):
       return self.directions
