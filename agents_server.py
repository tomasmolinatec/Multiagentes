# TC2008B. Sistemas Multiagentes y Gráficas Computacionales
# Python flask server to interact with webGL.
# Octavio Navarro. 2024

from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
from model import CityModel
from agent import Car, Traffic_Light, Obstacle

# Size of the board:
number_agents = 10
width = 28
height = 28
randomModel = None
currentStep = 0

# This application will be used to interact with WebGL
app = Flask("Traffic Project")
cors = CORS(app, origins=["http://localhost"])


# This route will be used to send the parameters of the simulation to the server.
# The servers expects a POST request with the parameters in a.json.
@app.route("/init", methods=["POST"])
@cross_origin()
def initModel():
    global currentStep, randomModel, number_agents, width, height

    if request.method == "POST":
        try:

            number_agents = int(request.json.get("NAgents"))
            width = int(request.json.get("width"))
            height = int(request.json.get("height"))
            currentStep = 0

            # Create the model using the parameters sent by the application
            randomModel = CityModel(0.1)
            width = randomModel.width
            height = randomModel.height

            # Return a message to saying that the model was created successfully
            return jsonify(
                {
                    "message": "Parameters recieved, model initiated.",
                    "width": width,
                    "height": height,
                }
            )

        except Exception as e:
            print(e)
            return jsonify({"message": "Erorr initializing the model"}), 500


@app.route("/getCars", methods=["GET"])
@cross_origin()
def getCars():
    global randomModel

    if request.method == "GET":
        try:
            carPositions = []
            for cell_content, (x, y) in randomModel.grid.coord_iter():
                for a in cell_content:
                    if isinstance(a, Car):
                        carPositions.append(
                            {"id": str(a.unique_id), "x": x, "y": 1, "z": y}
                        )

            return jsonify({"positions": carPositions})
        except Exception as e:
            print(e)
            return jsonify({"message": "Error with the car positions"}), 500


@app.route("/getBuildings", methods=["GET"])
@cross_origin()
def getBuildings():
    global randomModel

    if request.method == "GET":
        try:
            buildingPositions = []
            for cell_content, (x, y) in randomModel.grid.coord_iter():
                for a in cell_content:
                    if isinstance(a, Obstacle):
                        buildingPositions.append(
                            {"id": str(a.unique_id), "x": x, "y": 1, "z": y}
                        )

            return jsonify({"positions": buildingPositions})
        except Exception as e:
            print(e)
            return jsonify({"message": "Error with building positions"}), 500


@app.route("/getTrafficLights", methods=["GET"])
@cross_origin()
def getTrafficLights():
    global randomModel

    if request.method == "GET":
        try:
            trafficLightPositions = []
            for cell_content, (x, y) in randomModel.grid.coord_iter():
                for a in cell_content:
                    if isinstance(a, Traffic_Light):
                        trafficLightPositions.append(
                            {"id": str(a.unique_id), "x": x, "y": 1, "z": y}
                        )

            return jsonify({"positions": trafficLightPositions})
        except Exception as e:
            print(e)
            return jsonify({"message": "Error with building positions"}), 500


# This route will be used to update the model
@app.route("/update", methods=["GET"])
@cross_origin()
def updateModel():
    global currentStep, randomModel
    if request.method == "GET":
        try:
            # Update the model and return a message to WebGL saying that the model was updated successfully
            randomModel.step()
            currentStep += 1
            return jsonify(
                {
                    "message": f"Model updated to step {currentStep}.",
                    "currentStep": currentStep,
                }
            )
        except Exception as e:
            print(e)
            return jsonify({"message": "Error during step."}), 500


if __name__ == "__main__":
    # Run the flask server in port 8585
    app.run(host="localhost", port=8586, debug=True)
