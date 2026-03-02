import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

// Web socket for sending the data to the server
const socket = new WebSocket('wss://large-busy-hickory.glitch.me/');

// Log when the connection is open
socket.addEventListener('open', () => {
    console.log('WebSocket connection established');  
});

// Log errors
socket.addEventListener('error', (error) => {
    console.error('WebSocket error:', error);
});

// Log if the connection closes unexpectedly
socket.addEventListener('close', () => {
    console.warn('WebSocket connection closed');
});

// Create a scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Create a group to act as the player reference frame
const player = new THREE.Group();
scene.add(player);

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 10); // Camera at head height
player.add(camera);

// Create a renderer and add it to the DOM
const renderer = new THREE.WebGLRenderer({
    antialias: true // Enable antialiasing for smoother lines
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

// Add VR button to the page
document.body.appendChild(VRButton.createButton(renderer));
// If the device is a VR device, set the renderer to XR
if (navigator.xr) {
    renderer.xr.enabled = true;
}

// Lighting
const light = new THREE.DirectionalLight(0xffffff, 5);
light.position.set(0, 10, 10);
scene.add(light);

// Add a floor
const floorGeometry = new THREE.PlaneGeometry(10, 10);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

// Add a cube to the scene
const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
cube.position.set(0, 1, 0);
scene.add(cube);

// Add a sphere to the scene
const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff });
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
sphere.position.set(2, 0.5, 0);
scene.add(sphere);

// Add a cylinder to the scene
const cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
const cylinderMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
cylinder.position.set(-2, 0.5, 0);
scene.add(cylinder);


// Text display in VR
const createTextMesh = (text) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 400;
    context.font = '30px Arial';
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'black';
    // Convert \n to new x in fillText
    text.split('\n').forEach((line, i) => {
        context.fillText(line, 10, 50 + i * 40);
    });

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: false });
    const plane = new THREE.PlaneGeometry(3, 2);
    return new THREE.Mesh(plane, material);
};


let textMesh = createTextMesh('Initializing...');
textMesh.position.set(0, 4, -5);
scene.add(textMesh);

// Controllers
const controller1 = renderer.xr.getController(0);
const controller2 = renderer.xr.getController(1);
scene.add(controller1);
scene.add(controller2);


// Movement variables
let joystickInput = { x: 0, y: 0 };
const movementSpeed = 0.01;

// Handle input from controllers
function handleControllerInput() {
    const session = renderer.xr.getSession();
    if (!session) return;

    session.inputSources.forEach((inputSource) => {
        if (inputSource.gamepad && inputSource.handedness === 'left') {
            const axes = inputSource.gamepad.axes;
            joystickInput.x = axes[2]; // Left joystick horizontal (side-to-side)
            joystickInput.y = axes[3]; // Left joystick vertical (forward-backward)
        }
        
        // Controller button activity
        console.log(inputSource.handedness);
        console.log(inputSource.gamepad.axes);
        console.log(inputSource.gamepad.buttons);
    });
}

// Update player movement
function updatePlayerPosition() {
    const direction = new THREE.Vector3();

    // Move forward/backward and left/right based on joystick
    direction.set(joystickInput.x, 0, joystickInput.y).normalize();

    // Apply movement in the direction the camera is facing
    const cameraQuaternion = camera.quaternion;
    const moveVector = direction.applyQuaternion(cameraQuaternion).multiplyScalar(movementSpeed);

    player.position.add(moveVector);
}


function animate() {
    // Get head position and rotation
    const headPosition = new THREE.Vector3();
    const headQuaternion = new THREE.Quaternion();
    const headEuler = new THREE.Euler();

    const xrCamera = renderer.xr.getCamera(camera);
    xrCamera.getWorldPosition(headPosition);
    xrCamera.getWorldQuaternion(headQuaternion);
    headEuler.setFromQuaternion(headQuaternion, 'XYZ');

    console.log(`Head Position: ${headPosition.toArray()}`);
    console.log(`Head Rotation (Euler): ${headEuler.toArray()}`);
    
    let data = {};

    // Update text in VR
    let displayText = 'Head\n' 
        + `Roll: ${headEuler.x.toFixed(2)} Pitch: ${headEuler.y.toFixed(2)} Yaw: ${headEuler.z.toFixed(2)}\n` 
        + `X: ${headPosition.x.toFixed(2)} Y: ${headPosition.y.toFixed(2)} Z: ${headPosition.z.toFixed(2)}`;    

    data['head'] = {
        'position': headPosition.toArray(),
        'rotation': headEuler.toArray()
    };

    // Get controller positions and rotations
    if (controller1) {
        const position1 = new THREE.Vector3();
        const rotation1 = new THREE.Quaternion();
        controller1.matrixWorld.decompose(position1, rotation1, new THREE.Vector3());

        console.log(`Controller 1 Position: ${position1.toArray()}`);
        console.log(`Controller 1 Rotation: ${rotation1.toArray()}`);
        
        displayText += '\nController 1\n' 
            +  `Roll: ${rotation1.x.toFixed(2)} Pitch: ${rotation1.y.toFixed(2)} Yaw: ${rotation1.z.toFixed(2)}` + '\n'
            +  `X: ${position1.x.toFixed(2)} Y: ${position1.y.toFixed(2)} Z: ${position1.z.toFixed(2)}`;

        data['controller1'] = {
            'position': position1.toArray(),
            'rotation': rotation1.toArray()
        };
    } else {
        data['controller1'] = {
            'position': null,
            'rotation': null
        }
    }

    if (controller2) {
        const position2 = new THREE.Vector3();
        const rotation2 = new THREE.Quaternion();

        controller2.matrixWorld.decompose(position2, rotation2, new THREE.Vector3());

        console.log(`Controller 2 Position: ${position2.toArray()}`);
        console.log(`Controller 2 Rotation: ${rotation2.toArray()}`);

        displayText += '\nController 2\n' 
            +  `Roll: ${rotation2.x.toFixed(2)} Pitch: ${rotation2.y.toFixed(2)} Yaw: ${rotation2.z.toFixed(2)}` + '\n'
            +  `X: ${position2.x.toFixed(2)} Y: ${position2.y.toFixed(2)} Z: ${position2.z.toFixed(2)}`;

        data['controller2'] = {
            'position': position2.toArray(),
            'rotation': rotation2.toArray()
        };
    } else {
        data['controller2'] = {
            'position': null,
            'rotation': null
        }
    }

    data['timestamp'] = Date.now();

    // If vr is enabled and the socket is open, send the data
    if (renderer.xr.enabled && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
    } 
    
    // Add the text to the scene
    textMesh.material.map.dispose();
    scene.remove(textMesh);
    textMesh = createTextMesh(displayText);
    textMesh.position.set(0, 4, -5);
    scene.add(textMesh);

    // Move the player
    handleControllerInput();
    updatePlayerPosition();

    // Rotate the cube
	cube.rotation.x += 0.01;
	cube.rotation.y += 0.01;

	renderer.render(scene, camera);
}

// Resize the renderer when the window is resized
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});
