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
    const colors = [];

    const lines = objString.split("\n");

    // Definir un color predeterminado (blanco, por ejemplo)
    const defaultColor = [0.5, 0.0, 0.5]; // Color blanco RGB

    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const type = parts[0];

        if (type === "v") { // Vértices
            positions.push(...parts.slice(1).map(Number));
            colors.push(...defaultColor); // Asignar color predeterminado a cada vértice
        } else if (type === "vn") { // Normales
            normals.push(...parts.slice(1).map(Number));
        } else if (type === "f") { // Caras
            for (const vertex of parts.slice(1)) {
                const vertexIndex = parseInt(vertex.split("/")[0], 10) - 1; // Solo índice de posición
                indices.push(vertexIndex);
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
        a_color: {
            numComponents: 3,
            data: colors
        },
        indices: indices
    };
}

// Define the Object3D class to represent 3D objects
class Object3D {
    constructor(id, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
        this.id = id;
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
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
let gl, programInfo, agentArrays, buildingArrays, trafficLightArrays, agentsBufferInfo, buildingsBufferInfo, trafficLightsBufferInfo, agentsVao, buildingsVao, trafficLightsVao, gridBufferInfo, gridVao;

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
        x: 10,
        y: 10,
        z: 10,
    },
    ambientLightColor: [0.5, 0.5, 0.5, 1.0],
    diffuseLightColor: [0.5, 0.5, 0.5, 1.0],
    specularLightColor: [0.5, 0.5, 0.5, 1.0],
};

// Define model properties
const modelProperties = {
    ambientColor: [0.3, 0.6, 0.6, 1.0],
    diffuseColor: [0.3, 0.6, 0.6, 1.0],
    specularColor: [0.3, 0.6, 0.6, 1.0],
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

// Main function to initialize and run the application
async function main() {
    const canvas = document.querySelector('canvas');
    gl = canvas.getContext('webgl2');

    // Create the program information using the vertex and fragment shaders
    programInfo = twgl.createProgramInfo(gl, [vsGLSL, fsGLSL]);

    // Generate the agent and obstacle data
    agentArrays = [];
    buildingArrays = [];
    trafficLightArrays = [];

    // Set up the user interface
    setupUI();

    // Initialize the agents model
    await initAgentsModel();

    const gridArrays = createGridLines(data.width, data.height);
    gridBufferInfo = twgl.createBufferInfoFromArrays(gl, gridArrays);
    gridVao = twgl.createVAOFromBufferInfo(gl, programInfo, gridBufferInfo);

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

    await parseOBJFromFile("./light.obj").then(async (parsedObjArrays) => {
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

function createGridLines(width, height) {
    const positions = [];
    const normals = [];

    // Normal hacia arriba para todas las líneas del grid
    const normal = [0, 1, 0];

    // Líneas paralelas al eje Z (verticales en XZ)
    for (let x = 0; x <= width; x++) {
        positions.push(
            x, 0, 0,
            x, 0, height
        );
        normals.push(...normal, ...normal);
    }

    // Líneas paralelas al eje X (horizontales en XZ)
    for (let z = 0; z <= height; z++) {
        positions.push(
            0, 0, z,
            width, 0, z
        );
        normals.push(...normal, ...normal);
    }

    return {
        a_position: { numComponents: 3, data: positions },
        a_normal: { numComponents: 3, data: normals },
    };
}


function drawGrid(viewProjectionMatrix) {
    gl.bindVertexArray(gridVao);

    // Matriz de mundo para el grid
    let world = twgl.m4.identity();
    // Si es necesario, puedes aplicar transformaciones al grid aquí

    // Matrices requeridas por los shaders
    let worldViewProjection = twgl.m4.multiply(viewProjectionMatrix, world);
    let u_worldInverseTransform = twgl.m4.transpose(twgl.m4.inverse(world));

    // Uniforms del modelo
    let modelUniforms = {
        u_world: world,
        u_worldInverseTransform: u_worldInverseTransform,
        u_worldViewProjection: worldViewProjection,
        u_ambientColor: gridProperties.ambientColor,
        u_diffuseColor: gridProperties.diffuseColor,
        u_specularColor: gridProperties.specularColor,
        u_shininess: gridProperties.shininess,
    };

    twgl.setUniforms(programInfo, modelUniforms);

    // Dibujar el grid
    twgl.drawBufferInfo(gl, gridBufferInfo, gl.LINES);
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
            console.log(result.message)

            // Actualizar data.width y data.height con los valores recibidos del servidor
            data.width = result.width;
            data.height = result.height;

            console.log(`Grid dimensions updated: width=${data.width}, height=${data.height}`);
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
            console.log(result);

            // Crear un mapa de los IDs de los nuevos agentes
            const newAgentIds = result.positions.map(agent => agent.id);

            // Actualizar agentes existentes y agregar nuevos
            for (const agentData of result.positions) {
                const existingAgent = agents.find((object3d) => object3d.id == agentData.id);
                if (existingAgent) {
                    // Actualizar posición
                    existingAgent.position = [
                        agentData.x + 0.5,
                        agentData.y - 0.5,
                        data.height - agentData.z - 0.5
                    ];
                } else {
                    // Agregar nuevo agente
                    const newAgent = new Object3D(
                        agentData.id,
                        [agentData.x - 0.5, agentData.y - 0.5, data.height - agentData.z - 0.5],
                        [0, 0, 0],
                        [0.5, 0.5, 0.5]
                    );
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
                    [building.x + 0.5, building.y, data.height - building.z - 0.5],
                    [0, 0, 0]
                );
                buildings.push(newBuilding)
            }
            console.log("Buildings:", buildings)
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
                    [light.x - 0.5, light.y - 0.5, data.height - light.z - 0.5],
                    [0, 1.5, 0]
                );
                trafficLights.push(newLight)
            }
            console.log("Traffic Lights:", trafficLights)
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
            await getBuildings()
            await getTrafficLights()
            // Log a message indicating that the agents have been updated
            console.log("Updated agents")
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

    // Set the distance for rendering
    const distance = 1

    // Draw the agents
    drawAgents(distance, agentsVao, agentsBufferInfo, viewProjectionMatrix)

    // Draw the buildings
    drawBuildings(distance, buildingsVao, buildingsBufferInfo, viewProjectionMatrix)

    // drawTrafficLights(distance, trafficLightsVao, trafficLightsBufferInfo, viewProjectionMatrix)

    drawGrid(viewProjectionMatrix);


    // Increment the frame count
    frameCount++

    // Update the scene every 30 frames
    if (frameCount % 30 == 0) {
        frameCount = 0
        await update()
    }

    // Request the next frame
    requestAnimationFrame(() => drawScene(gl, programInfo, agentsVao, agentsBufferInfo, buildingsBufferInfo, buildingsVao, trafficLightsVao, trafficLightsBufferInfo));
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
        world = twgl.m4.rotateX(world, agent.rotation[0]);
        world = twgl.m4.rotateY(world, agent.rotation[1]);
        world = twgl.m4.rotateZ(world, agent.rotation[2]);
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
            u_ambientColor: modelProperties.ambientColor,
            u_diffuseColor: modelProperties.diffuseColor,
            u_specularColor: modelProperties.specularColor,
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
            u_ambientColor: modelProperties.ambientColor,
            u_diffuseColor: modelProperties.diffuseColor,
            u_specularColor: modelProperties.specularColor,
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