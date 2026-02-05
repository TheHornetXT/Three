import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// --- CONFIGURATION ---
const WALK_SPEED = 50.0;
const SPRINT_SPEED = 90.0;
const JUMP_FORCE = 20.0;     // Increased for better feel
const GRAVITY = 60.0;        // Higher gravity makes jumping feel snappy, not floaty
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 1.5;   // Distance from center to wall collision

// --- GLOBALS ---
let camera, scene, renderer, controls;
const wallObjects = []; 
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let canJump = false;
let isSprinting = false;

// Physics
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let prevTime = performance.now();

// FPS Counter
let frameCount = 0;
let lastTimeFPS = performance.now();
const fpsElem = document.getElementById('fps-counter');

init();
animate();

function init() {
    // 1. Scene & Fog (Fog hides the "infinite" edge)
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa0a0a0);
    scene.fog = new THREE.Fog(0xa0a0a0, 10, 80); // Fog starts at 10m, ends at 80m

    // 2. Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = PLAYER_HEIGHT;

    // 3. Lighting (Shadows & Softness)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = -50;
    dirLight.shadow.camera.left = -50;
    dirLight.shadow.camera.right = 50;
    scene.add(dirLight);

    // 4. Controls
    controls = new PointerLockControls(camera, document.body);
    
    // Click anywhere to lock
    document.addEventListener('click', () => {
        controls.lock();
    });

    // 5. Input
    const onKeyDown = (event) => {
        switch (event.code) {
            case 'KeyW': moveForward = true; break;
            case 'KeyA': moveLeft = true; break;
            case 'KeyS': moveBackward = true; break;
            case 'KeyD': moveRight = true; break;
            case 'Space': 
                if (canJump) {
                    velocity.y = JUMP_FORCE;
                    canJump = false;
                }
                break;
            case 'ShiftLeft': isSprinting = true; break;
        }
    };

    const onKeyUp = (event) => {
        switch (event.code) {
            case 'KeyW': moveForward = false; break;
            case 'KeyA': moveLeft = false; break;
            case 'KeyS': moveBackward = false; break;
            case 'KeyD': moveRight = false; break;
            case 'ShiftLeft': isSprinting = false; break;
        }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // 6. Level Generation
    createLevel();

    // 7. Renderer (High Quality)
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; // Turn on shadows
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
    document.body.appendChild(renderer.domElement);

    window.addEventListener('resize', onWindowResize);
}

function createLevel() {
    // Floor (Grid Texture for visual speed reference)
    const planeSize = 200;
    const loader = new THREE.TextureLoader();
    // Using a checkerboard pattern generated in code to avoid external assets for now
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,128,128);
    ctx.fillStyle = '#ccc'; 
    ctx.fillRect(0,0,64,64); ctx.fillRect(64,64,64,64);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(planeSize/4, planeSize/4);
    texture.magFilter = THREE.NearestFilter;

    const floorGeo = new THREE.PlaneGeometry(planeSize, planeSize);
    const floorMat = new THREE.MeshPhongMaterial({ 
        map: texture, 
        side: THREE.DoubleSide 
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Helper to make walls
    const createWall = (x, y, z, w, h, d, color) => {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshPhongMaterial({ color: color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        wallObjects.push(mesh);
    };

    // Walls
    createWall(5, 2.5, 0, 10, 5, 1, 0xff0000);  // Red Wall
    createWall(-5, 2.5, 5, 1, 5, 10, 0x00ff00); // Green Wall
    createWall(0, 2.5, -10, 20, 5, 1, 0x0000ff); // Blue Wall back
    createWall(10, 1, 10, 4, 2, 4, 0xffff00);   // Yellow box
    createWall(-8, 3, -5, 4, 6, 4, 0xff00ff);   // Purple pillar
}

// Simple Raycast Collision for horizontal movement
function detectCollision(newPosition) {
    const playerPos = controls.getObject().position.clone();
    
    // We only care about walls (horizontal), not floor
    // Direction vector from old pos to new pos
    const dir = new THREE.Vector3().subVectors(newPosition, playerPos).normalize();
    const dist = newPosition.distanceTo(playerPos);
    
    // Raycast
    const raycaster = new THREE.Raycaster(playerPos, dir, 0, PLAYER_RADIUS);
    const intersects = raycaster.intersectObjects(wallObjects);

    // If we hit something closer than our movement + radius buffer
    return intersects.length > 0;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updateFPS(currentTime) {
    frameCount++;
    if (currentTime - lastTimeFPS >= 1000) {
        fpsElem.textContent = "FPS: " + frameCount;
        frameCount = 0;
        lastTimeFPS = currentTime;
    }
}

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();
    updateFPS(time);

    if (controls.isLocked === true) {
        const delta = (time - prevTime) / 1000;

        // 1. Apply Friction/Damping (Stops you sliding forever)
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        
        // 2. Apply Gravity
        velocity.y -= GRAVITY * delta;

        // 3. Get Input Direction
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        // 4. Calculate Velocity based on Speed
        const currentSpeed = isSprinting ? SPRINT_SPEED : WALK_SPEED;
        
        if (moveForward || moveBackward) velocity.z -= direction.z * currentSpeed * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * currentSpeed * delta;

        // 5. Handle Horizontal Movement (With Collision)
        // We move Right (X) and Forward (Z) separately to allow sliding along walls
        
        // X-Axis Move
        controls.moveRight(-velocity.x * delta);
        if (detectCollision(controls.getObject().position)) {
            // If hit, undo move
            controls.moveRight(velocity.x * delta); 
            velocity.x = 0; 
        }

        // Z-Axis Move
        controls.moveForward(-velocity.z * delta);
        if (detectCollision(controls.getObject().position)) {
            // If hit, undo move
            controls.moveForward(velocity.z * delta);
            velocity.z = 0;
        }

        // 6. Handle Vertical Movement
        controls.getObject().position.y += (velocity.y * delta);

        // Floor Check
        if (controls.getObject().position.y < PLAYER_HEIGHT) {
            velocity.y = 0;
            controls.getObject().position.y = PLAYER_HEIGHT;
            canJump = true;
        }
    }

    prevTime = time;
    renderer.render(scene, camera);
}
