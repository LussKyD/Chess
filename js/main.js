// Global scope variables for Three.js
let scene, camera, renderer, controls;
const container = document.getElementById('container');
const BOARD_SIZE = 8;
const SQUARE_SIZE = 10;
const BOARD_WIDTH = BOARD_SIZE * SQUARE_SIZE;

// Expose resetCamera globally for the HTML button
window.resetCamera = resetCamera; 

/**
 * Initializes the three.js environment (Scene, Camera, Renderer, Lights).
 */
function init() {
    // 1. Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x303030); 
    scene.fog = new THREE.Fog(0x303030, 200, 300);

    // 2. Camera Setup
    camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 35, 70);
    
    // 3. Renderer Setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    container.appendChild(renderer.domElement);
    
    // 4. Lighting (Dramatic Castle Lighting)
    const ambientLight = new THREE.AmbientLight(0x404040); 
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 200;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    scene.add(directionalLight);
    
    // 5. Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 30;
    controls.maxDistance = 150;
    controls.target.set(0, 0, 0);

    // 6. Draw elements
    createCastleBoard();
    createCastleBackdrop();
    createChessPieces();

    // 7. Event Listeners
    window.addEventListener('resize', onWindowResize, false);
    container.addEventListener('touchstart', onTouchStart, false);
}

/**
 * Handles window resizing to maintain aspect ratio and redraw canvas.
 */
function onWindowResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

/**
 * Resets the camera view to the initial position.
 */
function resetCamera() {
    controls.reset();
}

/**
 * Creates the 8x8 checkerboard base with stone textures.
 */
function createCastleBoard() {
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x5a5a5a }); 

    const baseGeometry = new THREE.BoxGeometry(BOARD_WIDTH + 4, 2, BOARD_WIDTH + 4);
    const baseMesh = new THREE.Mesh(baseGeometry, floorMaterial);
    baseMesh.position.y = -1;
    baseMesh.receiveShadow = true;
    scene.add(baseMesh);

    const lightColor = new THREE.Color(0xc0c0c0); 
    const darkColor = new THREE.Color(0x404040); 

    for (let i = 0; i < BOARD_SIZE; i++) {
        for (let j = 0; j < BOARD_SIZE; j++) {
            const color = (i + j) % 2 === 0 ? lightColor : darkColor;
            const material = new THREE.MeshStandardMaterial({ color: color });
            const geometry = new THREE.BoxGeometry(SQUARE_SIZE, 0.5, SQUARE_SIZE);
            const square = new THREE.Mesh(geometry, material);

            // Position square relative to the center (0,0,0)
            square.position.x = (i - BOARD_SIZE / 2 + 0.5) * SQUARE_SIZE;
            square.position.z = (j - BOARD_SIZE / 2 + 0.5) * SQUARE_SIZE;
            square.position.y = 0.25; 

            square.receiveShadow = true;
            scene.add(square);
        }
    }
}

/**
 * Adds simple castle elements (pillars, walls) to set the scene.
 */
function createCastleBackdrop() {
    const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x696969 });

    // Four corner pillars
    const pillarPositions = [
        { x: -BOARD_WIDTH / 2 - 10, z: -BOARD_WIDTH / 2 - 10 },
        { x: BOARD_WIDTH / 2 + 10, z: -BOARD_WIDTH / 2 - 10 },
        { x: -BOARD_WIDTH / 2 - 10, z: BOARD_WIDTH / 2 + 10 },
        { x: BOARD_WIDTH / 2 + 10, z: BOARD_WIDTH / 2 + 10 }
    ];

    const pillarGeometry = new THREE.CylinderGeometry(3, 3, 50, 8);
    pillarPositions.forEach(pos => {
        const pillar = new THREE.Mesh(pillarGeometry, stoneMaterial);
        pillar.position.set(pos.x, 25, pos.z);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        scene.add(pillar);
    });
    
    // Simple Back Wall
    const wallGeometry = new THREE.BoxGeometry(BOARD_WIDTH * 2, 50, 5);
    const wall = new THREE.Mesh(wallGeometry, stoneMaterial);
    wall.position.set(0, 25, -BOARD_WIDTH - 20);
    wall.receiveShadow = true;
    scene.add(wall);
}

/**
 * Creates a single chess piece shape based on the type.
 * Note: Shapes are simplified royal/castle structures.
 */
function createPieceShape(type) {
    const group = new THREE.Group();
    const base = new THREE.CylinderGeometry(2, 2.5, 1, 12);
    const baseMesh = new THREE.Mesh(base);
    baseMesh.position.y = 0.5;
    group.add(baseMesh);

    // Simple geometry definitions for the royal theme
    switch (type) {
        case 'P': // Pawn (Sphere)
            const pawnHead = new THREE.SphereGeometry(1.5, 8, 8);
            const pawnMesh = new THREE.Mesh(pawnHead);
            pawnMesh.position.y = 3;
            group.add(pawnMesh);
            break;
        case 'R': // Rook (Tower)
            const rookBody = new THREE.BoxGeometry(3, 5, 3);
            const rookMesh = new THREE.Mesh(rookBody);
            rookMesh.position.y = 3.5;
            group.add(rookMesh);
            const topCylinder = new THREE.CylinderGeometry(3, 3, 0.5, 12);
            const topMesh = new THREE.Mesh(topCylinder);
            topMesh.position.y = 6;
            group.add(topMesh);
            break;
        case 'N': // Knight (Angular Body)
            const knightBody = new THREE.BoxGeometry(2, 5, 2);
            const knightMesh = new THREE.Mesh(knightBody);
            knightMesh.position.y = 3.5;
            group.add(knightMesh);
            const head = new THREE.BoxGeometry(1, 2, 3);
            const headMesh = new THREE.Mesh(head);
            headMesh.position.set(0.5, 5, -0.5);
            headMesh.rotation.y = Math.PI / 4;
            group.add(headMesh);
            break;
        case 'B': // Bishop (Mitre)
            const bishopBody = new THREE.CylinderGeometry(2, 2, 6, 8);
            const bishopMesh = new THREE.Mesh(bishopBody);
            bishopMesh.position.y = 3.5;
            group.add(bishopMesh);
            const sphereTop = new THREE.SphereGeometry(1.5, 12, 12);
            const sphereMesh = new THREE.Mesh(sphereTop);
            sphereMesh.position.y = 6.5;
            group.add(sphereMesh);
            break;
        case 'Q': // Queen (Crown)
            const queenBody = new THREE.CylinderGeometry(2.5, 2.5, 7, 16);
            const queenMesh = new THREE.Mesh(queenBody);
            queenMesh.position.y = 4;
            group.add(queenMesh);
            const crown = new THREE.TorusGeometry(2, 0.5, 8, 16);
            const crownMesh = new THREE.Mesh(crown);
            crownMesh.position.y = 8;
            crownMesh.rotation.x = Math.PI / 2;
            group.add(crownMesh);
            break;
        case 'K': // King (Cross)
            const kingBody = new THREE.CylinderGeometry(2.5, 2.5, 8, 16);
            const kingMesh = new THREE.Mesh(kingBody);
            kingMesh.position.y = 4.5;
            group.add(kingMesh);
            const crossV = new THREE.BoxGeometry(0.5, 3, 0.5);
            const crossH = new THREE.BoxGeometry(3, 0.5, 0.5);
            const crossV_Mesh = new THREE.Mesh(crossV);
            const crossH_Mesh = new THREE.Mesh(crossH);
            crossV_Mesh.position.y = 9.5;
            crossH_Mesh.position.y = 9.5;
            group.add(crossV_Mesh);
            group.add(crossH_Mesh);
            break;
    }
    
    // Enable shadows for all piece parts
    group.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    return group;
}

/**
 * Places all chess pieces in the initial starting positions (FEN setup).
 */
function createChessPieces() {
    const whiteMaterial = new THREE.MeshPhongMaterial({ color: 0xe0e0e0, shininess: 80 }); // Silver
    const blackMaterial = new THREE.MeshPhongMaterial({ color: 0x333333, shininess: 80 }); // Dark Steel

    const pieceMap = {
        0: ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
        1: ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        6: ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        7: ['R', 'N', 'B', 'K', 'Q', 'B', 'N', 'R']
    };

    for (let rank = 0; rank < BOARD_SIZE; rank++) {
        if (pieceMap[rank]) {
            const material = rank < 4 ? blackMaterial : whiteMaterial;
            const pieceTypes = rank < 4 ? pieceMap[rank] : pieceMap[7 - rank]; 
            
            for (let file = 0; file < BOARD_SIZE; file++) {
                const type = pieceTypes[file];
                const piece = createPieceShape(type);
                
                // Assign color material
                piece.traverse(child => {
                    if (child.isMesh) {
                        child.material = material;
                    }
                });

                // Calculate position relative to the center
                piece.position.x = (file - BOARD_SIZE / 2 + 0.5) * SQUARE_SIZE;
                piece.position.z = (rank - BOARD_SIZE / 2 + 0.5) * SQUARE_SIZE;
                piece.position.y = 0.5;
                piece.scale.set(1.5, 1.5, 1.5);
                scene.add(piece);
            }
        }
    }
}

/**
 * The main animation loop.
 */
function animate() {
    requestAnimationFrame(animate);
    controls.update(); 
    renderer.render(scene, camera);
}

/**
 * Handles touch events to prevent default browser behavior and ensure smooth 3D interaction.
 */
function onTouchStart(event) {
    if (event.touches.length > 0) {
        event.preventDefault(); 
    }
}

// Start the application after the window loads
window.onload = function () {
    init();
    animate(); 
}
