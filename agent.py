from mesa import Agent

class Car(Agent):
    
    directionsDecode = {
        "up": (0,1),
        "down": (0,-1),
        "right": (1,0),
        "left": (-1,0),
    }
    def __init__(self,  pos, model):
        """
        Creates a new random agent.
        Args:
            unique_id: The agent's ID
            model: Model reference for the agent
        """
        super().__init__(pos, model)
        self.pos = pos

    def move(self):
        agents = self.model.grid.get_cell_list_contents([self.pos])
        road = None
        for a in agents:
            if isinstance(a,Road):
                road = a
                break
        
        direction = road.getDirections()[0]
        position_to_move_to = (self.pos[0] + Car.directionsDecode[direction][0], self.pos[1] + Car.directionsDecode[direction][1])
        self.model.grid.move_agent(self, position_to_move_to)
        return



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
