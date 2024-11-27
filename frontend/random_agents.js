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

// Define the Object3D class to represent 3D objects
class Object3D {
    constructor(id, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], direction = "up") {
        this.id = id;
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
        this.direction = direction;
        this.matrix = twgl.m4.create();
    }
}

// Define the agent server URI
const agent_server_uri = "http://localhost:8586/";

// Initialize arrays to store agents and obstacles
const agents = [];
const buildings = []
const trafficLights = []

// Initialize WebGL-related variables
let gl, programInfo, agentArrays, buildingArrays, trafficLightArrays, agentsBufferInfo, buildingsBufferInfo, trafficLightsBufferInfo, agentsVao, buildingsVao, trafficLightsVao, gridBufferInfo, gridVao, roadLinesBufferInfo, roadLinesVao;

let lightBufferInfo, lightVao;

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
    width: 24,
    height: 25
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

    const gridArrays = createGridPlane(data.width, data.height);
    gridBufferInfo = twgl.createBufferInfoFromArrays(gl, gridArrays);
    gridVao = twgl.createVAOFromBufferInfo(gl, programInfo, gridBufferInfo);

    const roadLinesArrays = createRoadLines(data.width, data.height);
    roadLinesBufferInfo = twgl.createBufferInfoFromArrays(gl, roadLinesArrays);
    roadLinesVao = twgl.createVAOFromBufferInfo(gl, programInfo, roadLinesBufferInfo);

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

    // Get the agents and obstacles
    await getAgents();
    await getBuildings();
    await getTrafficLights();

    // Draw the scene
    await drawScene(gl, programInfo, agentsVao, agentsBufferInfo, buildingsBufferInfo, buildingsVao, trafficLightsVao, trafficLightsBufferInfo);
}

function createGridPlane(width, height) {
    const positions = [];
    const normals = [];
    const indices = [];

    // Normal hacia arriba para todas las caras
    const normal = [0, 1, 0];

    let index = 0;

    // Crear los cuadrados (celdas) del grid
    for (let x = 0; x < width; x++) {
        for (let z = 0; z < height; z++) {
            // Vértices de cada cuadrado
            positions.push(
                x, 0, z,
                x + 1, 0, z,
                x + 1, 0, z + 1,
                x, 0, z + 1
            );

            // Normales para cada vértice
            normals.push(...normal, ...normal, ...normal, ...normal);

            // Índices para dibujar los dos triángulos que forman el cuadrado
            indices.push(
                index, index + 1, index + 2,
                index, index + 2, index + 3
            );

            index += 4;
        }
    }

    return {
        a_position: { numComponents: 3, data: positions },
        a_normal: { numComponents: 3, data: normals },
        indices: indices
    };
}

function createRoadLines(width, height) {
    const positions = [];
    const normals = [];
    const indices = [];

    const normal = [0, 1, 0];
    let index = 0;

    // Ajuste: Dibujar líneas verticales en posiciones enteras
    for (let x = 0; x <= width; x++) {
        positions.push(
            x - 0.05, 0.1, 0,
            x + 0.05, 0.1, 0,
            x + 0.05, 0.1, height,
            x - 0.05, 0.1, height
        );

        normals.push(...normal, ...normal, ...normal, ...normal);

        indices.push(
            index, index + 1, index + 2,
            index, index + 2, index + 3
        );

        index += 4;
    }

    // Ajuste: Dibujar líneas horizontales en posiciones enteras
    for (let z = 0; z <= height; z++) {
        positions.push(
            0, 0.01, z - 0.05,
            width, 0.1, z - 0.05,
            width, 0.1, z + 0.05,
            0, 0.1, z + 0.05
        );

        normals.push(...normal, ...normal, ...normal, ...normal);

        indices.push(
            index, index + 1, index + 2,
            index, index + 2, index + 3
        );

        index += 4;
    }

    return {
        a_position: { numComponents: 3, data: positions },
        a_normal: { numComponents: 3, data: normals },
        indices: indices
    };
}

function drawGrid(viewProjectionMatrix) {
    gl.bindVertexArray(gridVao);

    // Matriz de mundo para el grid
    let world = twgl.m4.identity();
    // Puedes aplicar transformaciones al grid si es necesario

    // Matrices requeridas por los shaders
    let worldViewProjection = twgl.m4.multiply(viewProjectionMatrix, world);
    let u_worldInverseTransform = twgl.m4.transpose(twgl.m4.inverse(world));

    // Uniforms del modelo
    let modelUniforms = {
        u_world: world,
        u_worldInverseTransform: u_worldInverseTransform,
        u_worldViewProjection: worldViewProjection,
        u_ambientColor: [0.2, 0.2, 0.2, 1.0],  // Color negro para las calles
        u_diffuseColor: [0.2, 0.2, 0.2, 1.0],
        u_specularColor: [0.2, 0.2, 0.2, 1.0],
        u_shininess: 1.0,
    };

    twgl.setUniforms(programInfo, modelUniforms);

    // Dibujar el grid
    twgl.drawBufferInfo(gl, gridBufferInfo, gl.TRIANGLES);
}

function drawRoadLines(viewProjectionMatrix) {
    gl.bindVertexArray(roadLinesVao);

    // Matriz de mundo para las líneas
    let world = twgl.m4.identity();

    // Matrices requeridas por los shaders
    let worldViewProjection = twgl.m4.multiply(viewProjectionMatrix, world);
    let u_worldInverseTransform = twgl.m4.transpose(twgl.m4.inverse(world));

    // Uniforms del modelo
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

    // Dibujar las líneas
    twgl.drawBufferInfo(gl, roadLinesBufferInfo, gl.TRIANGLES);
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

            // Crear un mapa de los IDs de los nuevos agentes
            const newAgentIds = result.positions.map(agent => agent.id);

            // Actualizar agentes existentes y agregar nuevos
            for (const agentData of result.positions) {
                const existingAgent = agents.find((object3d) => object3d.id == agentData.id);
                if (existingAgent) {
                    // Actualizar posición
                    existingAgent.position = [
                        agentData.x + 0.5,
                        agentData.y - 1,
                        data.height - agentData.z - 0.5
                    ];
                    existingAgent.direction = agentData.direction;
                } else {
                    // Agregar nuevo agente
                    const newAgent = new Object3D(
                        agentData.id,
                        [agentData.x - 0.5, agentData.y - 1, data.height - agentData.z - 0.5],
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

            for (const light of result.positions) {
                const newLight = new Object3D(
                    light.id,
                    [light.x + 0.5, light.y - 0.5, data.height - light.z - 0.5],
                    [0, 0, 0],
                    [0.2, 0.2, 0.2]
                );
                trafficLights.push(newLight)
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
        // Send a request to the agent server to update the agent positions
        let response = await fetch(agent_server_uri + "update")

        // Check if the response was successful
        if (response.ok) {
            // Retrieve the updated agent positions
            await getAgents()
            // Log a message indicating that the agents have been updated
        }

    } catch (error) {
        // Log any errors that occur during the request
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
    drawAgents(distance, agentsVao, agentsBufferInfo, viewProjectionMatrix)

    // Draw the buildings
    drawBuildings(distance, buildingsVao, buildingsBufferInfo, viewProjectionMatrix)

    drawTrafficLights(distance, trafficLightsVao, trafficLightsBufferInfo, viewProjectionMatrix)

    drawGrid(viewProjectionMatrix);
    drawRoadLines(viewProjectionMatrix);


    // Increment the frame count
    frameCount++

    // Update the scene every 30 frames
    if (frameCount % 3 == 0) {
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
function drawAgents(distance, agentsVao, agentsBufferInfo, viewProjectionMatrix) {
    // Bind the vertex array object for agents
    gl.bindVertexArray(agentsVao);

    // Iterate over the agents
    for (const agent of agents) {
        // Compute the world matrix
        let world = twgl.m4.identity();
        world = twgl.m4.translate(world, agent.position);

        // Get rotation angle based on agent's direction
        let rotationAngle = getRotationAngle(agent.direction);
        // Rotate around Y-axis
        world = twgl.m4.rotateY(world, rotationAngle);

        // Apply scaling
        world = twgl.m4.scale(world, agent.scale);

        // Compute the worldViewProjection matrix
        let worldViewProjection = twgl.m4.multiply(viewProjectionMatrix, world);

        // Compute the world inverse transpose matrix
        let u_worldInverseTransform = twgl.m4.transpose(twgl.m4.inverse(world));

        // Set the model uniforms
        let modelUniforms = {
            u_world: world,
            u_worldInverseTransform: u_worldInverseTransform,
            u_worldViewProjection: worldViewProjection,
            u_ambientColor: [0.3, 0.6, 0.6, 1.0],
            u_diffuseColor: [0.3, 0.6, 0.6, 1.0],
            u_specularColor: [0.3, 0.6, 0.6, 1.0],
            u_shininess: modelProperties.shininess,
        };

        twgl.setUniforms(programInfo, modelUniforms);

        // Draw the object
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
        world = twgl.m4.rotateX(world, light.rotation[0]);
        world = twgl.m4.rotateY(world, light.rotation[1]);
        world = twgl.m4.rotateZ(world, light.rotation[2]);
        world = twgl.m4.scale(world, light.scale);

        // Compute the worldViewProjection matrix
        let worldViewProjection = twgl.m4.multiply(viewProjectionMatrix, world);

        // Compute the world inverse transpose matrix
        let u_worldInverseTransform = twgl.m4.transpose(twgl.m4.inverse(world));

        // Set the model uniforms
        let modelUniforms = {
            u_world: world,
            u_worldInverseTransform: u_worldInverseTransform,
            u_worldViewProjection: worldViewProjection,
            u_ambientColor: [0.1, 0.1, 0.1, 1.0],
            u_diffuseColor: [0.1, 0.1, 0.1, 1.0],
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
