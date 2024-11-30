from mesa import Agent
from collections import deque
import pprint
import copy


class Car(Agent):

     # Atributos de clase usados para logica del agente
    possibleLaneChange = {
        (0, 1): [(-1, 1), (1, 1)],
        (0, -1): [(-1, -1), (1, -1)],
        (1, 0): [(1, 1), (1, -1)],
        (-1, 0): [(-1, 1), (-1, -1)],
    }
    directionsDecode = {
        (0, 1): "up",
        (0, -1): "down",
        (1, 0): "right",
        (-1, 0): "left",
    }

    def __init__(self, unique_id, model, pos):
        
        super().__init__(unique_id, model)  # Call the Agent constructor

        # Atributos 
        self.originalPosition = pos  
        self.position = pos
        self.timeStopped = 0
        self.destination = self.model.getRandomDest() #Conseguri su destino
        # print("D:",self.destination)
        self.route = self.GetRoute(self.position) #Calcular ruta
        self.routeIndex = 0 #Indice de donde va en la ruta
        self.model.activeCars += 1
        self.stepCount = 0
        self.direction = 0
        self.directionWritten = "up"

    def GetRoute(self, start):
        """
        Encuentra el camino más corto a una estación de carga usando búsqueda en anchura (BFS).
        Retorna:
            path: Lista de celdas que llevan a la estación de carga más cercana
        """
        # Llave de memoizacion
        key = str(start) + str(self.destination)

        # Checamos si ya existe la llave
        if key in self.model.memo:
            # print("Used memoization!")
            self.model.memoCount += 1
            # print("Original Pos:", self.originalPosition)
            # print("Cur Pos:",self.position)
            # print("Destination:",self.destination)
            # print(self.model.memo[key])
            return self.model.memo[key]

        # Si no calculamos nuestra ruta con BFS
        # print("Didnt use memoization!")
        self.model.noMemoCount += 1
        q = deque(
            [(start, [])]
        )  # Cola para BFS con la posición actual y el camino recorrido
        visited = {start}  # Mantiene registro de las celdas visitadas

        while q:
            cur, path = q.popleft()  # Toma el primer elemento de la cola
            if cur == self.destination:
                self.model.memo[key] = copy.deepcopy(path)
                return path

            if cur not in self.model.graph:
                continue
            possible_moves = self.model.graph[cur] #Usamos el grafo para el BFS

            for move in possible_moves:
                if move not in visited:
                    visited.add(move)  # Marca la celda como visitada
                    q.append(
                        (move, path + [move])
                    )  # Añade la celda y el camino actualizado a la cola

    def canChangeLane(self):

        #Checar si podemos cambiar ruta y si si calculamos la nueva ruta
        if self.direction in Car.possibleLaneChange:
            relatives_directions = Car.possibleLaneChange[self.direction]
        else:
            return False


        for cell in relatives_directions:
            to_move = (self.position[0] + cell[0], self.position[1] + cell[1])
            if (
                to_move[0] >= 0
                and to_move[0] < self.model.width
                and to_move[1] >= 0
                and to_move[1] < self.model.height
                and self.isEmpty(to_move)
            ):
                self.ChangeRoute(to_move)
                # print(self.route)
                return True

        return False

    def isEmpty(self, pos):

        # Regresa un booleando dependiedo si se considera vacio el lugar
        agents = self.model.grid.get_cell_list_contents([pos])
        blocked_agents = {Car, Obstacle, Traffic_Light, Destination}

        return not any(
            isinstance(a, agent_type) for a in agents for agent_type in blocked_agents
        )

    def ChangeRoute(self, next_move):
        # Cambiar la ruta

        # print(next_move, self.GetRoute(next_move))
        self.route = [next_move] + self.GetRoute(next_move)
        self.routeIndex = 0
        # self.route[0] = next_mov

    def move(self):

        if self.position == self.destination: #Si ya llego a su destino, destruirse y reportar sus estadisticas
            # print("GOT THERE")
            self.model.grid.remove_agent(self)
            self.model.schedule.remove_car(self)
            self.model.activeCars -= 1
            self.model.arrived += 1
            self.model.addStepCount(self.stepCount)
            return

        next_move = self.route[self.routeIndex]

        self.direction = (
            next_move[0] - self.position[0],
            next_move[1] - self.position[1],
        )
        if self.direction in Car.directionsDecode:
            self.directionWritten = Car.directionsDecode[self.direction]

        #Logica de moverse
        canMove = True

        for agent in self.model.grid.get_cell_list_contents([self.position]):
            if isinstance(agent, Traffic_Light) and not agent.go:
                canMove = False

        if canMove:
            for agent in self.model.grid.get_cell_list_contents([next_move]):
                if isinstance(agent, Car):
                    if (
                        len(self.route) > 0
                        and self.timeStopped >= 1
                        and self.canChangeLane()
                    ):
                        next_move = self.route[self.routeIndex]
                    else:
                        canMove = False

        if canMove: # Si si se puede mover moverse
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

    def __init__(self, unique_id, model, start, cycle):
        super().__init__(unique_id, model)
        self.direction = "up"
        self.go = start
        self.cycle = cycle
        self.cur = 0

    def step(self):
       #Cambia de estado cada "cycle" steps
        self.cur += 1
        if not self.go:
            if self.cur >= self.cycle:
                self.cur = 0
                self.go = True
        else:
            if self.cur >= self.cycle:
                self.cur = 0
                self.go = False


class Destination(Agent):

    def __init__(self, unique_id, model):
        super().__init__(unique_id, model)

    def step(self):
        pass


class Obstacle(Agent):
  
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model)

    def step(self):
        pass


class Road(Agent):

    def __init__(self, unique_id, model, pos, direction):
        super().__init__(unique_id, model)
        self.position = pos
        self.direction = direction

    def step(self):
        pass
