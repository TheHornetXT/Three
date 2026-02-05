// Game variables
let scene, camera, renderer;
let player, controls;
let clock;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let canJump = false;
let velocity, direction;
let isSprinting = false;
let isCrouching = false;

// Player stats
const NORMAL_SPEED = 5;
const SPRINT_SPEED = 10;
const CROUCH_SPEED = 2.5;
const JUMP_VELOCITY = 8;
const GRAVITY = 20;
const NORMAL_HEIGHT = 1.8;
const CROUCH_HEIGHT = 0.9;

// Collision detection
let raycaster;
let collidableObjects = [];

// Initialize the game
function init() {
    console.log('Initializing game...');
    
    // Initialize Three.js objects
    velocity = new THREE.Vector3();
    direction = new THREE.Vector3();
    raycaster = new THREE.Raycaster();
    clock = new THREE.Clock();
    
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 0, 100);
    
    console.log('Scene created');

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, NORMAL_HEIGHT, 5);
    
    console.log('Camera created at position:', camera.position);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);
    
    console.log('Renderer created and added to DOM');

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    scene.add(directionalLight);
    
    console.log('Lights added');

    // Create ground
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x3a8c3f,
        roughness: 0.8
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    console.log('Ground created');

    // Create walls and obstacles for parkour
    createMap();
    
    console.log('Map created with', collidableObjects.length, 'collidable objects');

    // Setup controls
    setupControls();

    // Setup pointer lock
    setupPointerLock();

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);
    
    console.log('Game initialized successfully!');

    // Start animation loop
    animate();
}

function createMap() {
    // Material for walls
    const wallMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x808080,
        roughness: 0.7
    });

    // Create perimeter walls
    createWall(0, 2.5, -50, 100, 5, 1, wallMaterial);
    createWall(0, 2.5, 50, 100, 5, 1, wallMaterial);
    createWall(-50, 2.5, 0, 1, 5, 100, wallMaterial);
    createWall(50, 2.5, 0, 1, 5, 100, wallMaterial);

    // Create interior walls for parkour
    createWall(-20, 2.5, 0, 2, 5, 30, wallMaterial);
    createWall(20, 2.5, 0, 2, 5, 30, wallMaterial);
    createWall(0, 2.5, -20, 30, 5, 2, wallMaterial);
    createWall(0, 2.5, 20, 30, 5, 2, wallMaterial);

    // Create some boxes for climbing
    createBox(-10, 1, -10, 3, 2, 3, 0x8B4513);
    createBox(10, 1.5, -10, 3, 3, 3, 0x8B4513);
    createBox(-10, 2, 10, 3, 4, 3, 0x8B4513);
    createBox(10, 2.5, 10, 3, 5, 3, 0x8B4513);

    // Create elevated platforms
    createBox(-30, 3, -30, 8, 0.5, 8, 0x4a4a4a);
    createBox(30, 4, -30, 8, 0.5, 8, 0x4a4a4a);
    createBox(-30, 5, 30, 8, 0.5, 8, 0x4a4a4a);
    createBox(30, 6, 30, 8, 0.5, 8, 0x4a4a4a);
}

function createWall(x, y, z, width, height, depth, material) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const wall = new THREE.Mesh(geometry, material);
    wall.position.set(x, y, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    collidableObjects.push(wall);
}

function createBox(x, y, z, width, height, depth, color) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({ 
        color: color,
        roughness: 0.7
    });
    const box = new THREE.Mesh(geometry, material);
    box.position.set(x, y, z);
    box.castShadow = true;
    box.receiveShadow = true;
    scene.add(box);
    collidableObjects.push(box);
}

function setupControls() {
    // Keyboard controls
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);
}

function onKeyDown(event) {
    switch(event.code) {
        case 'KeyW':
            moveForward = true;
            break;
        case 'KeyS':
            moveBackward = true;
            break;
        case 'KeyA':
            moveLeft = true;
            break;
        case 'KeyD':
            moveRight = true;
            break;
        case 'Space':
            if (canJump) {
                velocity.y = JUMP_VELOCITY;
                canJump = false;
            }
            break;
        case 'ShiftLeft':
            isSprinting = true;
            break;
        case 'ControlLeft':
            isCrouching = true;
            updateCameraHeight();
            break;
    }
}

function onKeyUp(event) {
    switch(event.code) {
        case 'KeyW':
            moveForward = false;
            break;
        case 'KeyS':
            moveBackward = false;
            break;
        case 'KeyA':
            moveLeft = false;
            break;
        case 'KeyD':
            moveRight = false;
            break;
        case 'ShiftLeft':
            isSprinting = false;
            break;
        case 'ControlLeft':
            isCrouching = false;
            updateCameraHeight();
            break;
    }
}

function setupPointerLock() {
    const element = document.body;
    
    element.addEventListener('click', () => {
        element.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === element) {
            document.addEventListener('mousemove', onMouseMove, false);
        } else {
            document.removeEventListener('mousemove', onMouseMove, false);
        }
    });
}

let euler = new THREE.Euler(0, 0, 0, 'YXZ');
const PI_2 = Math.PI / 2;

function onMouseMove(event) {
    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    euler.setFromQuaternion(camera.quaternion);

    euler.y -= movementX * 0.002;
    euler.x -= movementY * 0.002;

    euler.x = Math.max(-PI_2, Math.min(PI_2, euler.x));

    camera.quaternion.setFromEuler(euler);
}

function updateCameraHeight() {
    const targetHeight = isCrouching ? CROUCH_HEIGHT : NORMAL_HEIGHT;
    camera.position.y = targetHeight;
}

function checkCollisions() {
    // Check if player is on the ground
    raycaster.set(camera.position, new THREE.Vector3(0, -1, 0));
    const intersections = raycaster.intersectObjects(collidableObjects, true);
    
    const onObject = intersections.length > 0 && intersections[0].distance < (isCrouching ? CROUCH_HEIGHT : NORMAL_HEIGHT) + 0.1;
    
    if (onObject) {
        canJump = true;
        if (velocity.y < 0) {
            velocity.y = 0;
        }
    }

    return onObject;
}

function checkWallCollision(direction, distance) {
    raycaster.set(camera.position, direction);
    const intersections = raycaster.intersectObjects(collidableObjects, true);
    return intersections.length > 0 && intersections[0].distance < distance;
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    // Apply gravity
    velocity.y -= GRAVITY * delta;

    // Get movement direction
    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();

    // Calculate speed based on state
    let speed = NORMAL_SPEED;
    if (isSprinting && !isCrouching) {
        speed = SPRINT_SPEED;
    } else if (isCrouching) {
        speed = CROUCH_SPEED;
    }

    // Calculate movement vector
    const moveVector = new THREE.Vector3();
    
    if (moveForward || moveBackward) {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        moveVector.add(forward.multiplyScalar(direction.z * speed * delta));
    }
    
    if (moveLeft || moveRight) {
        const right = new THREE.Vector3();
        camera.getWorldDirection(right);
        right.cross(camera.up);
        right.y = 0;
        right.normalize();
        moveVector.add(right.multiplyScalar(direction.x * speed * delta));
    }

    // Check wall collisions before moving
    if (moveVector.length() > 0) {
        const checkDirection = moveVector.clone().normalize();
        if (!checkWallCollision(checkDirection, 0.5)) {
            camera.position.add(moveVector);
        }
    }

    // Apply vertical velocity
    camera.position.y += velocity.y * delta;

    // Check ground collision
    const onGround = checkCollisions();
    
    if (camera.position.y < (isCrouching ? CROUCH_HEIGHT : NORMAL_HEIGHT)) {
        camera.position.y = isCrouching ? CROUCH_HEIGHT : NORMAL_HEIGHT;
        velocity.y = 0;
        canJump = true;
    }

    // Update HUD
    updateHUD();

    renderer.render(scene, camera);
}

function updateHUD() {
    const currentSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z).toFixed(2);
    document.getElementById('speed').textContent = currentSpeed;
    
    let state = 'Standing';
    if (isCrouching) state = 'Crouching';
    else if (isSprinting) state = 'Sprinting';
    if (!canJump) state += ' (Airborne)';
    document.getElementById('state').textContent = state;
    
    const pos = camera.position;
    document.getElementById('position').textContent = 
        `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Start the game when page loads
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, checking for THREE.js...');
    if (typeof THREE !== 'undefined') {
        console.log('THREE.js loaded successfully');
        init();
    } else {
        console.error('THREE.js failed to load!');
    }
});
