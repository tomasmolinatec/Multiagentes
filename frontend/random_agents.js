'use strict';

import * as twgl from 'twgl.js';
import GUI from 'lil-gui';

import vsGLSL from './shaders/vs_phong.glsl?raw';
import fsGLSL from './shaders/fs_phong.glsl?raw';

// Función para leer el archivo .obj
function parseOBJFromFile(filePath) {
    return fetch(filePath)
        .then(response => response.text())
        .then(objString => parseOBJ(objString));
}

// Función para parsear el archivo OBJ
function parseOBJ(objString) {
    const positions = [];
    const normals = [];
    const indices = [];

    const positionData = [];
    const normalData = [];

    const lines = objString.split("\n");

    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const type = parts[0];

        if (type === "v") { // Vertex positions
            positionData.push(parts.slice(1).map(Number));
        } else if (type === "vn") { // Vertex normals
            normalData.push(parts.slice(1).map(Number));
        } else if (type === "f") { // Faces
            const faceVertices = parts.slice(1);
            for (const vertex of faceVertices) {
                const [vIndexStr, vtIndexStr, vnIndexStr] = vertex.split('/');

                // Parse indices (subtract 1 because OBJ indices start at 1)
                const vIndex = parseInt(vIndexStr, 10) - 1;
                const vnIndex = parseInt(vnIndexStr, 10) - 1;

                positions.push(...positionData[vIndex]);
                normals.push(...normalData[vnIndex]);

                // Since we're expanding the vertices, indices are sequential
                indices.push(indices.length);
            }
        }
    }

    return {
        a_position: {
            numComponents: 3,
            data: positions
        },
        a_normal: {
            numComponents: 3,
            data: normals
        },
        indices: indices
    };
}

function getRotationAngle(direction) {
    switch (direction) {
        case 'up':
            return 0;  // Facing along positive Z-axis
        case 'down':
            return Math.PI;  // Facing along negative Z-axis
        case 'right':
            return -Math.PI / 2;  // Facing along negative X-axis
        case 'left':
            return Math.PI / 2;  // Facing along positive X-axis
        default:
            return 0;  // Default to 'up' if direction is undefined
    }
}

function oppositeDirection(direction) {
    switch (direction) {
        case 'up':
            return 'down';
        case 'down':
            return 'up';
        case 'left':
            return 'right';
        case 'right':
            return 'left';
        default:
            return 'up';  // Valor por defecto si la dirección es indefinida
    }
}

// Define the Object3D class to represent 3D objects
class Object3D {
    constructor(id, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], direction = "up", go = true, color = [1, 1, 1, 1]) {
        this.id = id;
        this.position = position; // Posición actual (interpolada)
        this.initialPosition = position.slice(); // Posición inicial antes de la interpolación
        this.targetPosition = position.slice(); // Posición objetivo para la interpolación
        this.rotation = rotation;
        this.scale = scale;
        this.direction = direction;
        this.matrix = twgl.m4.create();
        this.progress = 1; // Inicialmente, sin interpolación pendiente
        this.elapsedTime = 0;
        this.interpolationDuration = 200;
        this.go = go; // Duración de la interpolación en segundos
        this.color = color;
    }
}

// Define the agent server URI
const agent_server_uri = "http://localhost:8586/";

// Initialize arrays to store agents and obstacles
const agents = [];
const buildings = []
const trafficLights = []
const roads = []

// Initialize WebGL-related variables
let gl, programInfo, agentArrays, buildingArrays, trafficLightArrays, agentsBufferInfo, buildingsBufferInfo, trafficLightsBufferInfo, agentsVao, buildingsVao, trafficLightsVao, gridBufferInfo, gridVao, roadLinesBufferInfo, roadLinesVao;

let roadBufferInfo, roadVao, lineBufferInfo, lineVao;

let lightBufferInfo, lightVao;
let lastRenderTime = 0;

// Define the camera position
let cameraPosition = { x: 0, y: 50, z: 0.01 };

// Initialize the frame count
let frameCount = 0;

// Define settings for the lighting and camera
const settings = {
    cameraPosition: {
        x: 0,
        y: 50,
        z: 0.01,
    },
    lightPosition: {
        x: 0,
        y: 30,
        z: 0,
    },
    ambientLightColor: [0.5, 0.5, 0.5, 1.0],
    diffuseLightColor: [0.5, 0.5, 0.5, 1.0],
    specularLightColor: [0.5, 0.5, 0.5, 1.0],
};

// Define model properties
const modelProperties = {
    ambientColor: [0.8, 0.8, 0.8, 1.0],  // Color gris claro
    diffuseColor: [0.8, 0.8, 0.8, 1.0],  // Color gris claro
    specularColor: [0.8, 0.8, 0.8, 1.0],  // Color gris claro,
    shininess: 60.0,
};

const gridProperties = {
    ambientColor: [0.8, 0.8, 0.8, 1.0],  // Color gris claro
    diffuseColor: [0.8, 0.8, 0.8, 1.0],
    specularColor: [0.0, 0.0, 0.0, 1.0], // Sin componente especular
    shininess: 1.0,
};

// Define the data object
const data = {
    NAgents: 3,
    width: 30,
    height: 30
};

function createLightRepresentation() {
    // Crear una esfera pequeña para representar la luz
    lightBufferInfo = twgl.primitives.createSphereBufferInfo(gl, 0.5, 12, 6);
    lightVao = twgl.createVAOFromBufferInfo(gl, programInfo, lightBufferInfo);
}

// Main function to initialize and run the application
async function main() {
    const canvas = document.querySelector('canvas');
    gl = canvas.getContext('webgl2');

    // Create the program information using the vertex and fragment shaders
    programInfo = twgl.createProgramInfo(gl, [vsGLSL, fsGLSL]);

    createLightRepresentation();

    // Generate the agent and obstacle data
    agentArrays = [];
    buildingArrays = [];
    trafficLightArrays = [];

    // Set up the user interface
    setupUI();

    // Initialize the agents model
    await initAgentsModel();

    // const gridArrays = createGridPlane(data.width, data.height);
    // gridBufferInfo = twgl.createBufferInfoFromArrays(gl, gridArrays);
    // gridVao = twgl.createVAOFromBufferInfo(gl, programInfo, gridBufferInfo);

    // const roadLinesArrays = createRoadLines(data.width, data.height);
    // roadLinesBufferInfo = twgl.createBufferInfoFromArrays(gl, roadLinesArrays);
    // roadLinesVao = twgl.createVAOFromBufferInfo(gl, programInfo, roadLinesBufferInfo);

    // Get the agents and obstacles
    await getAgents();
    await getBuildings();
    await getTrafficLights();
    await getRoads();

    const roadGeometry = createRoadGeometry(roads);

    roadBufferInfo = twgl.createBufferInfoFromArrays(gl, roadGeometry.roadPositions);
    roadVao = twgl.createVAOFromBufferInfo(gl, programInfo, roadBufferInfo);

    lineBufferInfo = twgl.createBufferInfoFromArrays(gl, roadGeometry.linePositions);
    lineVao = twgl.createVAOFromBufferInfo(gl, programInfo, lineBufferInfo);

    await parseOBJFromFile("./car_red.obj").then(async (parsedObjArrays) => {
        agentArrays = parsedObjArrays;
    }).catch(error => console.error('Error loading OBJ file:', error));;

    agentsBufferInfo = twgl.createBufferInfoFromArrays(gl, agentArrays);
    agentsVao = twgl.createVAOFromBufferInfo(gl, programInfo, agentsBufferInfo);

    await parseOBJFromFile("./build.obj").then(async (parsedObjArrays) => {
        buildingArrays = parsedObjArrays;
    }).catch(error => console.error('Error loading OBJ file:', error));;

    buildingsBufferInfo = twgl.createBufferInfoFromArrays(gl, buildingArrays);
    buildingsVao = twgl.createVAOFromBufferInfo(gl, programInfo, buildingsBufferInfo);

    await parseOBJFromFile("./traffic_light.obj").then(async (parsedObjArrays) => {
        trafficLightArrays = parsedObjArrays;
    }).catch(error => console.error('Error loading OBJ file:', error));;

    trafficLightsBufferInfo = twgl.createBufferInfoFromArrays(gl, trafficLightArrays);
    trafficLightsVao = twgl.createVAOFromBufferInfo(gl, programInfo, trafficLightsBufferInfo);



    lastRenderTime = performance.now()

    // Draw the scene
    await drawScene(gl, programInfo, agentsVao, agentsBufferInfo, buildingsBufferInfo, buildingsVao, trafficLightsVao, trafficLightsBufferInfo);
}

function createRoadGeometry(roads) {
    const positions = [];
    const normals = [];
    const indices = [];

    const linePositions = [];
    const lineNormals = [];
    const lineIndices = [];

    let index = 0;
    let lineIndex = 0;

    const normal = [0, 1, 0];  // Normal hacia arriba para todas las caras
    const laneOffset = 0.01;   // Desplazamiento desde el borde de la celda
    const laneWidth = 0.05;    // Ancho de la línea del carril

    for (const road of roads) {
        const x = road.position[0];
        const z = road.position[2];  // Suponiendo que y es arriba, z es profundidad

        // Crear el quad para la celda de la carretera
        positions.push(
            x, 0, z,
            x + 1, 0, z,
            x + 1, 0, z + 1,
            x, 0, z + 1
        );
        normals.push(...normal, ...normal, ...normal, ...normal);
        indices.push(
            index, index + 1, index + 2,
            index, index + 2, index + 3
        );
        index += 4;

        if (road.direction == "up" || road.direction == "down") {
            // Dibujar líneas en los bordes izquierdo y derecho para calles verticales
            // Línea izquierda
            linePositions.push(
                x + laneOffset - laneWidth / 2, 0.01, z,
                x + laneOffset + laneWidth / 2, 0.01, z,
                x + laneOffset + laneWidth / 2, 0.01, z + 1,
                x + laneOffset - laneWidth / 2, 0.01, z + 1,
            );
            lineNormals.push(...normal, ...normal, ...normal, ...normal);
            lineIndices.push(
                lineIndex, lineIndex + 1, lineIndex + 2,
                lineIndex, lineIndex + 2, lineIndex + 3
            );
            lineIndex += 4;

            // Línea derecha
            linePositions.push(
                x + 1 - laneOffset - laneWidth / 2, 0.01, z,
                x + 1 - laneOffset + laneWidth / 2, 0.01, z,
                x + 1 - laneOffset + laneWidth / 2, 0.01, z + 1,
                x + 1 - laneOffset - laneWidth / 2, 0.01, z + 1,
            );
            lineNormals.push(...normal, ...normal, ...normal, ...normal);
            lineIndices.push(
                lineIndex, lineIndex + 1, lineIndex + 2,
                lineIndex, lineIndex + 2, lineIndex + 3
            );
            lineIndex += 4;

        } else if (road.direction == "left" || road.direction == "right") {
            // Dibujar líneas en los bordes superior e inferior para calles horizontales
            // Línea inferior
            linePositions.push(
                x, 0.01, z + laneOffset - laneWidth / 2,
                x + 1, 0.01, z + laneOffset - laneWidth / 2,
                x + 1, 0.01, z + laneOffset + laneWidth / 2,
                x, 0.01, z + laneOffset + laneWidth / 2,
            );
            lineNormals.push(...normal, ...normal, ...normal, ...normal);
            lineIndices.push(
                lineIndex, lineIndex + 1, lineIndex + 2,
                lineIndex, lineIndex + 2, lineIndex + 3
            );
            lineIndex += 4;

            // Línea superior
            linePositions.push(
                x, 0.01, z + 1 - laneOffset - laneWidth / 2,
                x + 1, 0.01, z + 1 - laneOffset - laneWidth / 2,
                x + 1, 0.01, z + 1 - laneOffset + laneWidth / 2,
                x, 0.01, z + 1 - laneOffset + laneWidth / 2,
            );
            lineNormals.push(...normal, ...normal, ...normal, ...normal);
            lineIndices.push(
                lineIndex, lineIndex + 1, lineIndex + 2,
                lineIndex, lineIndex + 2, lineIndex + 3
            );
            lineIndex += 4;
        }
    }

    return {
        roadPositions: {
            a_position: { numComponents: 3, data: positions },
            a_normal: { numComponents: 3, data: normals },
            indices: indices
        },
        linePositions: {
            a_position: { numComponents: 3, data: linePositions },
            a_normal: { numComponents: 3, data: lineNormals },
            indices: lineIndices
        }
    };
}

function drawRoads(viewProjectionMatrix) {
    gl.bindVertexArray(roadVao);

    let world = twgl.m4.identity();

    let worldViewProjection = twgl.m4.multiply(viewProjectionMatrix, world);
    let u_worldInverseTransform = twgl.m4.transpose(twgl.m4.inverse(world));

    let modelUniforms = {
        u_world: world,
        u_worldInverseTransform: u_worldInverseTransform,
        u_worldViewProjection: worldViewProjection,
        u_ambientColor: [0.2, 0.2, 0.2, 1.0],  // Color oscuro para el pavimento
        u_diffuseColor: [0.2, 0.2, 0.2, 1.0],
        u_specularColor: [0.2, 0.2, 0.2, 1.0],
        u_shininess: 1.0,
    };

    twgl.setUniforms(programInfo, modelUniforms);

    twgl.drawBufferInfo(gl, roadBufferInfo, gl.TRIANGLES);
}

function drawLines(viewProjectionMatrix) {
    gl.bindVertexArray(lineVao);

    let world = twgl.m4.identity();

    let worldViewProjection = twgl.m4.multiply(viewProjectionMatrix, world);
    let u_worldInverseTransform = twgl.m4.transpose(twgl.m4.inverse(world));

    let modelUniforms = {
        u_world: world,
        u_worldInverseTransform: u_worldInverseTransform,
        u_worldViewProjection: worldViewProjection,
        u_ambientColor: [1.0, 1.0, 1.0, 1.0],  // Color blanco para las líneas
        u_diffuseColor: [1.0, 1.0, 1.0, 1.0],
        u_specularColor: [1.0, 1.0, 1.0, 1.0],
        u_shininess: 1.0,
    };

    twgl.setUniforms(programInfo, modelUniforms);

    twgl.drawBufferInfo(gl, lineBufferInfo, gl.TRIANGLES);
}

/*
 * Initializes the agents model by sending a POST request to the agent server.
 */
async function initAgentsModel() {
    try {
        // Send a POST request to the agent server to initialize the model
        let response = await fetch(agent_server_uri + "init", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })

        // Check if the response was successful
        if (response.ok) {
            // Parse the response as JSON and log the message
            let result = await response.json()

            // Actualizar data.width y data.height con los valores recibidos del servidor
            data.width = result.width;
            data.height = result.height;
        }

    } catch (error) {
        // Log any errors that occur during the request
        console.log(error)
    }
}

/*
 * Retrieves the current positions of all agents from the agent server.
 */
async function getAgents() {
    try {
        let response = await fetch(agent_server_uri + "getCars")

        if (response.ok) {
            let result = await response.json();

            const newAgentIds = result.positions.map(agent => agent.id);

            for (const agentData of result.positions) {
                const existingAgent = agents.find((object3d) => object3d.id == agentData.id);
                const newTargetPosition = [
                    agentData.x + 0.5,
                    agentData.y - 1,
                    data.height - agentData.z - 0.5
                ];

                if (existingAgent) {
                    // Preparar la interpolación
                    existingAgent.initialPosition = existingAgent.position.slice();
                    existingAgent.targetPosition = newTargetPosition;
                    existingAgent.elapsedTime = 0;
                    existingAgent.progress = 0;
                    existingAgent.direction = agentData.direction;
                } else {
                    // Agregar nuevo agente
                    const newAgent = new Object3D(
                        agentData.id,
                        newTargetPosition,
                        [0, 0, 0],
                        [0.5, 0.5, 0.5]
                    );
                    newAgent.direction = agentData.direction;
                    agents.push(newAgent);
                }
            }

            // Eliminar agentes que ya no están presentes
            for (let i = agents.length - 1; i >= 0; i--) {
                if (!newAgentIds.includes(agents[i].id)) {
                    agents.splice(i, 1);
                }
            }
        }

    } catch (error) {
        console.log(error)
    }
}

async function getBuildings() {
    try {
        let response = await fetch(agent_server_uri + "getBuildings")

        if (response.ok) {
            let result = await response.json()

            for (const building of result.positions) {
                const newBuilding = new Object3D(
                    building.id,
                    [building.x + 0.5, building.y - 1, data.height - building.z - 0.5],
                    [0, 0, 0]
                );
                buildings.push(newBuilding)
            }
        }

    } catch (error) {
        console.log(error)
    }
}

async function getTrafficLights() {
    try {
        let response = await fetch(agent_server_uri + "getTrafficLights")

        if (response.ok) {
            let result = await response.json()

            // Crear un mapa de los IDs de los nuevos semáforos
            const newLightIds = result.positions.map(light => light.id);

            // Actualizar semáforos existentes y agregar nuevos
            for (const lightData of result.positions) {
                const existingLight = trafficLights.find((object3d) => object3d.id == lightData.id);
                if (existingLight) {
                    // Actualizar posición y estado
                    existingLight.position = [
                        lightData.x + 0.5,
                        lightData.y - 0.5,
                        data.height - lightData.z - 0.5
                    ];
                    existingLight.direction = lightData.direction;
                    existingLight.go = lightData.go; // Actualizar el estado 'go'
                } else {
                    // Agregar nuevo semáforo
                    const newLight = new Object3D(
                        lightData.id,
                        [lightData.x + 0.5, lightData.y - 0.5, data.height - lightData.z - 0.5],
                        [0, 0, 0],
                        [0.2, 0.2, 0.2]
                    );
                    newLight.direction = lightData.direction;
                    newLight.go = lightData.go; // Establecer el estado 'go'
                    trafficLights.push(newLight);
                }
            }

            // Eliminar semáforos que ya no están presentes
            for (let i = trafficLights.length - 1; i >= 0; i--) {
                if (!newLightIds.includes(trafficLights[i].id)) {
                    trafficLights.splice(i, 1);
                }
            }
        }

    } catch (error) {
        console.log(error)
    }
}

async function getRoads() {
    try {
        let response = await fetch(agent_server_uri + "getRoads")

        if (response.ok) {
            let result = await response.json()

            for (const roadData of result.positions) {
                const newRoad = new Object3D(
                    roadData.id,
                    [roadData.x, 0, data.height - roadData.z - 1],
                    [0, 0, 0],
                    [1, 1, 1]
                );
                newRoad.direction = roadData.direction;
                roads.push(newRoad)
            }
        }

    } catch (error) {
        console.log(error)
    }
}

/*
 * Updates the agent positions by sending a request to the agent server.
 */
async function update() {
    try {
        // Enviar una solicitud al servidor para actualizar el modelo y obtener datos
        let response = await fetch(agent_server_uri + "update")

        // Verificar si la respuesta fue exitosa
        if (response.ok) {
            // Parsear la respuesta JSON
            let result = await response.json();

            // Actualizar los agentes (carros)
            const carData = result.cars;
            const newAgentIds = carData.map(agent => agent.id);

            for (const agentData of carData) {
                const existingAgent = agents.find((object3d) => object3d.id == agentData.id);
                const newTargetPosition = [
                    agentData.x + 0.5,
                    agentData.y - 1,
                    data.height - agentData.z - 0.5
                ];

                if (existingAgent) {
                    // Preparar la interpolación
                    existingAgent.initialPosition = existingAgent.position.slice();
                    existingAgent.targetPosition = newTargetPosition;
                    existingAgent.elapsedTime = 0;
                    existingAgent.progress = 0;
                    existingAgent.direction = agentData.direction;
                } else {
                    const randomColor = [
                        Math.random(), // Valor aleatorio entre 0 y 1 para el componente rojo
                        Math.random(), // Valor aleatorio entre 0 y 1 para el componente verde
                        Math.random(), // Valor aleatorio entre 0 y 1 para el componente azul
                        1.0            // Componente alfa (opacidad)
                    ];

                    // Agregar nuevo agente
                    const newAgent = new Object3D(
                        agentData.id,
                        newTargetPosition,
                        [0, 0, 0],
                        [0.5, 0.5, 0.5]
                    );
                    newAgent.direction = agentData.direction;
                    newAgent.color = randomColor;
                    agents.push(newAgent);
                }
            }

            // Eliminar agentes que ya no están presentes
            for (let i = agents.length - 1; i >= 0; i--) {
                if (!newAgentIds.includes(agents[i].id)) {
                    agents.splice(i, 1);
                }
            }

            // Actualizar semáforos
            const trafficLightData = result.trafficLights;
            const newLightIds = trafficLightData.map(light => light.id);

            for (const lightData of trafficLightData) {
                const existingLight = trafficLights.find((object3d) => object3d.id == lightData.id);
                if (existingLight) {
                    // Actualizar estado y posición si es necesario
                    existingLight.go = lightData.go;
                    // Si la posición o dirección puede cambiar, actualizar también:
                    // existingLight.position = [...];
                    // existingLight.direction = lightData.direction;
                } else {
                    // Agregar nuevo semáforo
                    const newLight = new Object3D(
                        lightData.id,
                        [lightData.x + 0.5, lightData.y - 0.5, data.height - lightData.z - 0.5],
                        [0, 0, 0],
                        [0.2, 0.2, 0.2],
                        lightData.direction,
                        lightData.go
                    );
                    trafficLights.push(newLight);
                }
            }

            // Eliminar semáforos que ya no están presentes
            for (let i = trafficLights.length - 1; i >= 0; i--) {
                if (!newLightIds.includes(trafficLights[i].id)) {
                    trafficLights.splice(i, 1);
                }
            }
        }

    } catch (error) {
        // Registrar cualquier error que ocurra durante la solicitud
        console.log(error)
    }
}
/*
 * Draws the scene by rendering the agents and obstacles.
 * 
 * @param {WebGLRenderingContext} gl - The WebGL rendering context.
 * @param {Object} programInfo - The program information.
 * @param {WebGLVertexArrayObject} agentsVao - The vertex array object for agents.
 * @param {Object} agentsBufferInfo - The buffer information for agents.
 * @param {WebGLVertexArrayObject} obstaclesVao - The vertex array object for obstacles.
 * @param {Object} obstaclesBufferInfo - The buffer information for obstacles.
 */


async function drawScene(gl, programInfo, agentsVao, agentsBufferInfo, buildingsBufferInfo, buildingsVao, trafficLightsVao, trafficLightsBufferInfo) {
    const now = performance.now();// Convertir a segundos
    let deltaTime = now - lastRenderTime;
    const maxDeltaTime = 100; // Máximo deltaTime permitido (100 ms)
    if (deltaTime > maxDeltaTime) deltaTime = maxDeltaTime;
    lastRenderTime = now;
    // Resize the canvas to match the display size
    twgl.resizeCanvasToDisplaySize(gl.canvas);

    // Set the viewport to match the canvas size
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Set the clear color and enable depth testing
    gl.clearColor(0.2, 0.2, 0.2, 1);
    gl.enable(gl.DEPTH_TEST);

    // Clear the color and depth buffers
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Use the program
    gl.useProgram(programInfo.program);

    // Set up the global uniforms
    const v3_cameraPosition = [settings.cameraPosition.x, settings.cameraPosition.y, settings.cameraPosition.z];
    const v3_lightPosition = [settings.lightPosition.x, settings.lightPosition.y, settings.lightPosition.z];

    const globalUniforms = {
        u_viewWorldPosition: v3_cameraPosition,
        u_lightWorldPosition: v3_lightPosition,
        u_ambientLight: settings.ambientLightColor,
        u_diffuseLight: settings.diffuseLightColor,
        u_specularLight: settings.specularLightColor,
    };
    twgl.setUniforms(programInfo, globalUniforms);

    // Set up the view-projection matrix
    const viewProjectionMatrix = setupWorldView(gl);

    drawLight(viewProjectionMatrix);

    // Set the distance for rendering
    const distance = 1



    // Draw the agents
    drawAgents(deltaTime, agentsVao, agentsBufferInfo, viewProjectionMatrix)

    // Draw the buildings
    drawBuildings(distance, buildingsVao, buildingsBufferInfo, viewProjectionMatrix)

    drawTrafficLights(distance, trafficLightsVao, trafficLightsBufferInfo, viewProjectionMatrix)

    // drawGrid(viewProjectionMatrix);
    // drawRoadLines(viewProjectionMatrix);

    drawRoads(viewProjectionMatrix);
    drawLines(viewProjectionMatrix);


    // Increment the frame count
    frameCount++

    // Update the scene every 30 frames
    if (frameCount % 10 == 0) {
        frameCount = 0
        await update()
    }

    // Request the next frame
    requestAnimationFrame(() => drawScene(gl, programInfo, agentsVao, agentsBufferInfo, buildingsBufferInfo, buildingsVao, trafficLightsVao, trafficLightsBufferInfo));
}

function drawLight(viewProjectionMatrix) {
    gl.bindVertexArray(lightVao);

    // Matriz de mundo para la luz
    let world = twgl.m4.identity();
    world = twgl.m4.translate(world, [settings.lightPosition.x, settings.lightPosition.y, settings.lightPosition.z]);
    world = twgl.m4.scale(world, [1, 1, 1]); // Escalar si es necesario

    // Calcular las matrices requeridas
    let worldViewProjection = twgl.m4.multiply(viewProjectionMatrix, world);
    let u_worldInverseTransform = twgl.m4.transpose(twgl.m4.inverse(world));

    // Uniformes del modelo para la luz
    let modelUniforms = {
        u_world: world,
        u_worldInverseTransform: u_worldInverseTransform,
        u_worldViewProjection: worldViewProjection,
        u_ambientColor: [1.0, 1.0, 0.0, 1.0],  // Color amarillo brillante
        u_diffuseColor: [1.0, 1.0, 0.0, 1.0],
        u_specularColor: [1.0, 1.0, 0.0, 1.0],
        u_shininess: 100.0,
    };

    twgl.setUniforms(programInfo, modelUniforms);

    // Dibujar la esfera de la luz
    twgl.drawBufferInfo(gl, lightBufferInfo);
}

/*
 * Draws the agents.
 * 
 * @param {Number} distance - The distance for rendering.
 * @param {WebGLVertexArrayObject} agentsVao - The vertex array object for agents.
 * @param {Object} agentsBufferInfo - The buffer information for agents.
 * @param {Float32Array} viewProjectionMatrix - The view-projection matrix.
 */
function drawAgents(deltaTime, agentsVao, agentsBufferInfo, viewProjectionMatrix) {
    gl.bindVertexArray(agentsVao);

    for (const agent of agents) {
        // Actualizar progreso de interpolación
        if (agent.progress < 1) {
            agent.elapsedTime += deltaTime;
            agent.progress = agent.elapsedTime / agent.interpolationDuration;
            if (agent.progress > 1) agent.progress = 1;

            // Interpolar posición
            agent.position = [
                agent.initialPosition[0] + (agent.targetPosition[0] - agent.initialPosition[0]) * agent.progress,
                agent.initialPosition[1] + (agent.targetPosition[1] - agent.initialPosition[1]) * agent.progress,
                agent.initialPosition[2] + (agent.targetPosition[2] - agent.initialPosition[2]) * agent.progress
            ];
        } else {
            // Asegurar que la posición es la posición objetivo al finalizar la interpolación
            agent.position = agent.targetPosition.slice();
        }

        // Construir matriz de mundo
        let world = twgl.m4.identity();
        world = twgl.m4.translate(world, agent.position);

        // Obtener ángulo de rotación basado en la dirección del agente
        let rotationAngle = getRotationAngle(agent.direction);
        world = twgl.m4.rotateY(world, rotationAngle);

        // Aplicar escala
        world = twgl.m4.scale(world, agent.scale);

        // Calcular matrices requeridas
        let worldViewProjection = twgl.m4.multiply(viewProjectionMatrix, world);
        let u_worldInverseTransform = twgl.m4.transpose(twgl.m4.inverse(world));

        // Establecer uniformes
        let modelUniforms = {
            u_world: world,
            u_worldInverseTransform: u_worldInverseTransform,
            u_worldViewProjection: worldViewProjection,
            u_ambientColor: agent.color,
            u_diffuseColor: agent.color,
            u_specularColor: [0.5, 0.5, 0.5, 1.0],
            u_shininess: modelProperties.shininess,
        };

        twgl.setUniforms(programInfo, modelUniforms);

        // Dibujar el objeto
        twgl.drawBufferInfo(gl, agentsBufferInfo);
    }
}

function drawBuildings(distance, buildingsVao, buildingsBufferInfo, viewProjectionMatrix) {
    gl.bindVertexArray(buildingsVao);

    for (const building of buildings) {
        // Compute the world matrix
        let world = twgl.m4.identity();
        world = twgl.m4.translate(world, building.position);
        world = twgl.m4.rotateX(world, building.rotation[0]);
        world = twgl.m4.rotateY(world, building.rotation[1]);
        world = twgl.m4.rotateZ(world, building.rotation[2]);
        world = twgl.m4.scale(world, building.scale);

        // Compute the worldViewProjection matrix
        let worldViewProjection = twgl.m4.multiply(viewProjectionMatrix, world);

        // Compute the world inverse transpose matrix
        let u_worldInverseTransform = twgl.m4.transpose(twgl.m4.inverse(world));

        // Set the model uniforms
        let modelUniforms = {
            u_world: world,
            u_worldInverseTransform: u_worldInverseTransform,
            u_worldViewProjection: worldViewProjection,
            u_ambientColor: modelProperties.ambientColor,
            u_diffuseColor: modelProperties.diffuseColor,
            u_specularColor: modelProperties.specularColor,
            u_shininess: modelProperties.shininess,
        };

        twgl.setUniforms(programInfo, modelUniforms);

        // Draw the object
        twgl.drawBufferInfo(gl, buildingsBufferInfo);

    }
}

function drawTrafficLights(distance, trafficLightsVao, trafficLightsBufferInfo, viewProjectionMatrix) {
    gl.bindVertexArray(trafficLightsVao);

    for (const light of trafficLights) {
        // Compute the world matrix
        let world = twgl.m4.identity();
        world = twgl.m4.translate(world, light.position);

        // Obtener el ángulo de rotación basado en la dirección opuesta
        let rotationAngle = getRotationAngle(oppositeDirection(light.direction));
        // Rotar alrededor del eje Y
        world = twgl.m4.rotateY(world, rotationAngle);

        // Aplicar escala
        world = twgl.m4.scale(world, light.scale);

        // Compute the worldViewProjection matrix
        let worldViewProjection = twgl.m4.multiply(viewProjectionMatrix, world);

        let lightColor;
        if (light.go) {
            // Semáforo en verde
            lightColor = [0.0, 1.0, 0.0, 1.0]; // Verde brillante
        } else {
            // Semáforo en rojo
            lightColor = [1.0, 0.0, 0.0, 1.0]; // Rojo brillante
        }

        // Compute the world inverse transpose matrix
        let u_worldInverseTransform = twgl.m4.transpose(twgl.m4.inverse(world));

        // Set the model uniforms
        let modelUniforms = {
            u_world: world,
            u_worldInverseTransform: u_worldInverseTransform,
            u_worldViewProjection: worldViewProjection,
            u_ambientColor: lightColor,
            u_diffuseColor: lightColor,
            u_specularColor: [0.1, 0.1, 0.1, 1.0],
            u_shininess: modelProperties.shininess,
        };

        twgl.setUniforms(programInfo, modelUniforms);

        // Draw the object
        twgl.drawBufferInfo(gl, trafficLightsBufferInfo);

    }
}


/*
 * Sets up the world view by creating the view-projection matrix.
 * 
 * @param {WebGLRenderingContext} gl - The WebGL rendering context.
 * @returns {Float32Array} The view-projection matrix.
 */
function setupWorldView(gl) {
    // Set the field of view (FOV) in radians
    const fov = 45 * Math.PI / 180;

    // Calculate the aspect ratio of the canvas
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;

    // Create the projection matrix
    const projectionMatrix = twgl.m4.perspective(fov, aspect, 1, 200);

    // Set the target position
    const target = [data.width / 2, 0, data.height / 2];

    // Set the up vector
    const up = [0, 1, 0];

    // Calculate the camera position
    const camPos = [
        settings.cameraPosition.x + data.width / 2,
        settings.cameraPosition.y,
        settings.cameraPosition.z + data.height / 2
    ];

    // Create the camera matrix
    const cameraMatrix = twgl.m4.lookAt(camPos, target, up);

    // Calculate the view matrix
    const viewMatrix = twgl.m4.inverse(cameraMatrix);

    // Calculate the view-projection matrix
    const viewProjectionMatrix = twgl.m4.multiply(projectionMatrix, viewMatrix);

    // Return the view-projection matrix
    return viewProjectionMatrix;
}

/*
 * Sets up the user interface (UI) for the camera position.
 */
function setupUI() {
    // Create a new GUI instance
    const gui = new GUI();

    // Camera position
    const posFolder = gui.addFolder('Camera Position:')
    posFolder.add(settings.cameraPosition, 'x', -50, 50);
    posFolder.add(settings.cameraPosition, 'y', -50, 50);
    posFolder.add(settings.cameraPosition, 'z', -50, 50);

    // Light settings
    const lightFolder = gui.addFolder('Light Settings:')
    lightFolder.add(settings.lightPosition, 'x', -50, 50);
    lightFolder.add(settings.lightPosition, 'y', -50, 50);
    lightFolder.add(settings.lightPosition, 'z', -50, 50);
    lightFolder.addColor(settings, 'ambientLightColor');
    lightFolder.addColor(settings, 'diffuseLightColor');
    lightFolder.addColor(settings, 'specularLightColor');

    // Model properties
    const modelFolder = gui.addFolder('Model Properties:')
    modelFolder.addColor(modelProperties, 'ambientColor');
    modelFolder.addColor(modelProperties, 'diffuseColor');
    modelFolder.addColor(modelProperties, 'specularColor');
    modelFolder.add(modelProperties, 'shininess', 0, 600).step(1);
}

main()
