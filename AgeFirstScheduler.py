from mesa.time import BaseScheduler

class AgeFirstScheduler(BaseScheduler):
    def step(self):
        """Advance each agent in order of their age (or another attribute)."""
        # Sort agents by age attribute (descending for older first)
        sorted_agents = sorted(self.agents, key=lambda x: x.age, reverse=True)
        for agent in sorted_agents:
            agent.step()
        self.steps += 1
        self.time += 1