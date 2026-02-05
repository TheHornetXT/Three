import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// --- CONFIGURATION ---
const MOVEMENT_SPEED = 10.0;
const SPRINT_MULTIPLIER = 1.8;
const CROUCH_SPEED = 5.0;
const JUMP_FORCE = 15.0;
const WALL_JUMP_FORCE_UP = 20.0;
const WALL_JUMP_FORCE_SIDE = 15.0;
const GRAVITY = 40.0;
const PLAYER_HEIGHT = 1.8;
const CROUCH_HEIGHT = 0.9;

// --- GLOBALS ---
let camera, scene, renderer, controls;
let raycaster;
const objects = []; // Array to hold walls for collision
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;
let isSprinting = false;
let isCrouching = false;

// Physics vectors
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let prevTime = performance.now();

init();
animate();

function init() {
    // 1. Setup Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    scene.fog = new THREE.Fog(0xffffff, 0, 750);

    // 2. Setup Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = PLAYER_HEIGHT;

    // 3. Setup Lights
    const light = new THREE.HemisphereLight(0xeeeeff, 0x777788, 0.75);
    light.position.set(0.5, 1, 0.75);
    scene.add(light);

    // 4. Setup Controls (Pointer Lock)
    controls = new PointerLockControls(camera, document.body);
    
    const instructions = document.getElementById('instructions');
    instructions.addEventListener('click', () => {
        controls.lock();
    });

    controls.addEventListener('lock', () => {
        instructions.style.display = 'none';
    });

    controls.addEventListener('unlock', () => {
        instructions.style.display = 'flex';
    });

    scene.add(controls.getObject());

    // 5. Input Handling
    const onKeyDown = (event) => {
        switch (event.code) {
            case 'ArrowUp': case 'KeyW': moveForward = true; break;
            case 'ArrowLeft': case 'KeyA': moveLeft = true; break;
            case 'ArrowDown': case 'KeyS': moveBackward = true; break;
            case 'ArrowRight': case 'KeyD': moveRight = true; break;
            case 'Space': 
                if (canJump) {
                    velocity.y = JUMP_FORCE;
                    canJump = false;
                } else {
                    // Wall Jump Check
                    checkWallJump();
                }
                break;
            case 'ShiftLeft': isSprinting = true; break;
            case 'KeyC': 
                if(!isCrouching) {
                    isCrouching = true; 
                    camera.position.y -= (PLAYER_HEIGHT - CROUCH_HEIGHT);
                }
                break;
        }
    };

    const onKeyUp = (event) => {
        switch (event.code) {
            case 'ArrowUp': case 'KeyW': moveForward = false; break;
            case 'ArrowLeft': case 'KeyA': moveLeft = false; break;
            case 'ArrowDown': case 'KeyS': moveBackward = false; break;
            case 'ArrowRight': case 'KeyD': moveRight = false; break;
            case 'ShiftLeft': isSprinting = false; break;
            case 'KeyC': 
                if(isCrouching) {
                    isCrouching = false;
                    camera.position.y += (PLAYER_HEIGHT - CROUCH_HEIGHT);
                }
                break;
        }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // 6. Build the Map
    createLevel();

    // 7. Setup Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // 8. Resize Handler
    window.addEventListener('resize', onWindowResize);

    // 9. Raycaster for collision
    raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 10);
}

function createLevel() {
    // Floor
    const floorGeometry = new THREE.PlaneGeometry(2000, 2000, 100, 100);
    const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // Create some walls for wall jumping
    // Helper function to create box
    const createBox = (x, y, z, w, h, d, color) => {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshPhongMaterial({ color: color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        scene.add(mesh);
        objects.push(mesh); // Add to collision array
        return mesh;
    };

    // A large wall to jump on
    createBox(10, 5, 0, 2, 10, 20, 0xff0000); 
    // A platform
    createBox(-10, 2, -10, 5, 4, 5, 0x00ff00);
    // A high wall
    createBox(0, 10, -20, 20, 20, 2, 0x0000ff);
}

function checkWallJump() {
    // Simple wall jump logic: cast rays in 4 directions to see if we are close to a wall
    const directions = [
        new THREE.Vector3(1, 0, 0),  // Right
        new THREE.Vector3(-1, 0, 0), // Left
        new THREE.Vector3(0, 0, 1),  // Forward
        new THREE.Vector3(0, 0, -1)  // Backward
    ];

    // Align directions with player rotation
    const rotation = controls.getObject().rotation.y;

    for(let dir of directions) {
        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation); // Rotate ray to match player facing
        raycaster.set(controls.getObject().position, dir);
        
        const intersects = raycaster.intersectObjects(objects);

        // If we hit a wall within 2 units
        if (intersects.length > 0 && intersects[0].distance < 2) {
            velocity.y = WALL_JUMP_FORCE_UP;
            
            // Push off the wall (optional: add horizontal force away from wall)
            // For now, just vertical pop makes it feel like "climbing/parkour"
            return;
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    
    // Physics Logic
    if (controls.isLocked === true) {
        const delta = (time - prevTime) / 1000;

        // Friction / Damping
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 10.0 * delta; // Gravity

        // Determine Speed
        let actualSpeed = MOVEMENT_SPEED;
        if (isSprinting) actualSpeed *= SPRINT_MULTIPLIER;
        if (isCrouching) actualSpeed = CROUCH_SPEED;

        // Calculate Movement Direction
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize(); // Ensure consistent speed in all directions

        if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta * (actualSpeed / 10);
        if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta * (actualSpeed / 10);

        // Apply Movement
        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        
        // Vertical Movement (Jumping/Falling)
        controls.getObject().position.y += (velocity.y * delta); 

        // Floor Collision (Simple y < PLAYER_HEIGHT check)
        // Note: For crouching, we check floor relative to current height
        let currentHeight = isCrouching ? CROUCH_HEIGHT : PLAYER_HEIGHT;
        
        if (controls.getObject().position.y < currentHeight) {
            velocity.y = 0;
            controls.getObject().position.y = currentHeight;
            canJump = true;
        }
    }

    prevTime = time;
    renderer.render(scene, camera);
}
