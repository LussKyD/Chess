// Global scope variables for Three.js
let scene, camera, renderer, controls;
const container = document.getElementById('container');
const BOARD_SIZE = 8;
const SQUARE_SIZE = 10;
const BOARD_WIDTH = BOARD_SIZE * SQUARE_SIZE;

// --- Chess Engine and Game State ---
let game = new Chess(); // The chess.js engine instance
window.game = game; // Expose globally for debugging
let currentBoardState = {}; // Stores the latest FEN/turn from Firebase

// --- Interaction ---
let raycaster, mouse;
let selectedPiece = null;
const HIGHLIGHT_COLOR = 0xfbd38d; // Gold/Royal highlight

// Expose functions globally
window.resetCamera = resetCamera; 
window.updateBoardFromFEN = updateBoardFromFEN; // Expose for Firebase to call

// --- Animation Loop (MOVED TO TOP TO PREVENT REFERENCE ERROR) ---

/**
 * Renders the scene and updates controls every frame.
 */
function animate() {
    requestAnimationFrame(animate);

    // Required for the damping effect of the controls
    if (controls) {
        controls.update(); 
    }

    renderer.render(scene, camera);
}


// --- Coordinate Conversion Helpers (remain the same) ---

/**
 * Converts Three.js file/rank coordinates (0-7) to algebraic notation (a1-h8).
 * @param {number} file - 0 to 7 (A to H)
 * @param {number} rank - 0 to 7 (1 to 8)
 * @returns {string} Algebraic notation (e.g., 'a1', 'h8')
 */
function toAlgebraic(file, rank) {
    const fileChar = String.fromCharCode('a'.charCodeAt(0) + file);
    const rankNum = rank + 1;
    return fileChar + rankNum;
}

/**
 * Converts algebraic notation (a1-h8) to Three.js file/rank coordinates (0-7).
 * @param {string} algebraic - Algebraic notation (e.g., 'a1', 'h8')
 * @returns {{file: number, rank: number}} Coords
 */
function to3DCoords(algebraic) {
    const file = algebraic.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = parseInt(algebraic.charAt(1), 10) - 1;
    
    const x = (file - BOARD_SIZE / 2 + 0.5) * SQUARE_SIZE;
    const z = (rank - BOARD_SIZE / 2 + 0.5) * SQUARE_SIZE;
    return new THREE.Vector3(x, 0.5, z);
}


// --- Three.js Setup (init, utility functions, event handlers) ---

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

    // 7. Raycasting Setup 
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Initial draw
    updateBoardFromFEN(game.fen());
}

function onWindowResize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function resetCamera() {
    controls.reset();
}

function createCastleBoard() {
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x5a5a5a }); 
    window.boardSquares = []; // Store squares globally for easy access

    const baseGeometry = new THREE.BoxGeometry(BOARD_WIDTH + 4, 2, BOARD_WIDTH + 4);
    const baseMesh = new THREE.Mesh(baseGeometry, floorMaterial);
    baseMesh.position.y = -1;
    baseMesh.receiveShadow = true;
    scene.add(baseMesh);

    const lightColor = new THREE.Color(0xc0c0c0); 
    const darkColor = new THREE.Color(0x404040); 

    for (let rank = 0; rank < BOARD_SIZE; rank++) {
        for (let file = 0; file < BOARD_SIZE; file++) {
            const color = (file + rank) % 2 === 0 ? lightColor : darkColor;
            const material = new THREE.MeshStandardMaterial({ color: color });
            const geometry = new THREE.BoxGeometry(SQUARE_SIZE, 0.5, SQUARE_SIZE);
            const square = new THREE.Mesh(geometry, material);
            
            square.isSquare = true;
            square.originalColor = color;
            square.userData.algebraic = toAlgebraic(file, rank); // Store algebraic name
            square.userData.file = file; 
            square.userData.rank = rank;

            square.position.x = (file - BOARD_SIZE / 2 + 0.5) * SQUARE_SIZE;
            square.position.z = (rank - BOARD_SIZE / 2 + 0.5) * SQUARE_SIZE;
            square.position.y = 0.25; 

            square.receiveShadow = true;
            scene.add(square);
            window.boardSquares.push(square);
        }
    }
}

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
 * Creates a single chess piece shape based on the type (K, Q, R, B, N, P).
 */
function createPieceShape(type) {
    const group = new THREE.Group();
    const base = new THREE.CylinderGeometry(2, 2.5, 1, 12);
    const baseMesh = new THREE.Mesh(base);
    baseMesh.position.y = 0.5;
    group.add(baseMesh);

    // Simple geometry definitions (same as before)
    switch (type.toUpperCase()) {
        case 'P': 
            const pawnHead = new THREE.SphereGeometry(1.5, 8, 8);
            const pawnMesh = new THREE.Mesh(pawnHead);
            pawnMesh.position.y = 3;
            group.add(pawnMesh);
            break;
        case 'R': 
            const rookBody = new THREE.BoxGeometry(3, 5, 3);
            const rookMesh = new THREE.Mesh(rookBody);
            rookMesh.position.y = 3.5;
            group.add(rookMesh);
            const topCylinder = new THREE.CylinderGeometry(3, 3, 0.5, 12);
            const topMesh = new THREE.Mesh(topCylinder);
            topMesh.position.y = 6;
            group.add(topMesh);
            break;
        case 'N': 
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
        case 'B': 
            const bishopBody = new THREE.CylinderGeometry(2, 2, 6, 8);
            const bishopMesh = new THREE.Mesh(bishopBody);
            bishopMesh.position.y = 3.5;
            group.add(bishopMesh);
            const sphereTop = new THREE.SphereGeometry(1.5, 12, 12);
            const sphereMesh = new THREE.Mesh(sphereTop);
            sphereMesh.position.y = 6.5;
            group.add(sphereMesh);
            break;
        case 'Q': 
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
        case 'K': 
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
    
    group.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    
    group.isPiece = true;
    group.pieceType = type.toUpperCase();

    return group;
}

/**
 * Renders the 3D chess pieces based on the FEN string from chess.js.
 */
function updateBoardFromFEN(fen) {
    // 1. Clear existing pieces from the scene
    const piecesToRemove = scene.children.filter(obj => obj.isPiece);
    piecesToRemove.forEach(piece => scene.remove(piece));

    // 2. Set the engine's state
    try {
        game.load(fen);
    } catch (e) {
        console.error("Invalid FEN string received:", fen, e);
        document.getElementById('status-message').textContent = "ERROR: Invalid Game State.";
        return;
    }

    // 3. Draw new pieces
    const board = game.board(); // Returns 8x8 array of squares
    
    const whiteMaterial = new THREE.MeshPhongMaterial({ color: 0xe0e0e0, shininess: 80 }); 
    const blackMaterial = new THREE.MeshPhongMaterial({ color: 0x333333, shininess: 80 }); 

    for (let rank = 0; rank < BOARD_SIZE; rank++) {
        for (let file = 0; file < BOARD_SIZE; file++) {
            const pieceData = board[7 - rank][file]; // Chess array is rank 8-1, we iterate 0-7
            
            if (pieceData) {
                const pieceType = pieceData.type.toUpperCase();
                const pieceColor = pieceData.color === 'w' ? 'white' : 'black';
                const material = pieceColor === 'white' ? whiteMaterial : blackMaterial;
                
                const piece = createPieceShape(pieceType);
                
                piece.pieceColor = pieceColor;
                piece.userData.algebraic = toAlgebraic(file, rank); // Store current position
                
                // Assign color material to children
                piece.traverse(child => {
                    if (child.isMesh) {
                        child.material = material;
                    }
                });

                // Set position
                const pos = to3DCoords(piece.userData.algebraic);
                piece.position.set(pos.x, pos.y, pos.z);

                piece.scale.set(1.5, 1.5, 1.5);
                scene.add(piece);
            }
        }
    }
}

/**
 * Resets all board squares to their original color.
 */
function clearHighlights() {
    window.boardSquares.forEach(square => {
        square.material.color.set(square.originalColor);
        // Clear emissive highlights too
        square.material.emissive.setHex(0x000000); 
        square.material.emissiveIntensity = 0;
    });
}

/**
 * Highlights a selected piece and potential move squares.
 */
function highlightPiece(piece) {
    // Clear previous state first
    if (selectedPiece) {
        selectedPiece.position.y -= 1.5; // Lower previous piece
        selectedPiece.traverse(child => {
            if (child.isMesh) {
                child.material.emissive.setHex(0x000000); 
                child.material.emissiveIntensity = 0;
            }
        });
    }
    clearHighlights();
    selectedPiece = null;


    if (piece) {
        // Set new selected piece state
        selectedPiece = piece;
        selectedPiece.position.y += 1.5; // Raise selected piece slightly
        
        // Highlight piece itself (Emissive color for subtle highlight effect)
        selectedPiece.traverse(child => {
             if (child.isMesh) {
                 child.material.emissive.setHex(HIGHLIGHT_COLOR); 
                 child.material.emissiveIntensity = 0.5;
             }
        });

        // ----------------------------------------------------
        // Highlight possible move squares using chess.js
        // ----------------------------------------------------
        const moves = game.moves({ square: piece.userData.algebraic, verbose: true });
        
        window.boardSquares.forEach(square => {
            const targetSquare = square.userData.algebraic;
            // Check if targetSquare is in the list of valid moves
            const isValidTarget = moves.some(move => move.to === targetSquare);

            if (isValidTarget) {
                square.material.color.set(0x8bc34a); // Green highlight for moves
            }
        });

        document.getElementById('status-message').textContent = 
            `${piece.pieceColor.toUpperCase()} ${piece.pieceType} selected from ${piece.userData.algebraic}.`;
    } 
}

/**
 * Handles the click event for piece selection or movement.
 */
function handleClick(clientX, clientY) {
    // Retrieve the current user role from the Firebase script (or Offline Mode fallback)
    const userRole = window.currentUserRole; 
    const turnColor = game.turn(); // 'w' or 'b'
    
    // ----------------------------------------------------
    // NEW BLOCK: Turn and Role Restriction
    // ----------------------------------------------------
    if (!userRole) {
        // This should only happen during initialization. 
        // In offline mode, userRole is set to 'w' immediately by firebase.js.
        document.getElementById('status-message').textContent = 
            `Please wait for the game to load your player role.`;
        highlightPiece(null);
        return; 
    }
    
    // Check if it's the current user's turn
    if (userRole !== turnColor) {
        document.getElementById('status-message').textContent = 
            `It is ${turnColor === 'w' ? 'White' : 'Black'}'s turn, not yours.`;
        highlightPiece(null);
        return;
    }
    // ----------------------------------------------------
    
    // 1. Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ( (clientX - rect.left) / rect.width ) * 2 - 1;
    mouse.y = - ( (clientY - rect.top) / rect.height ) * 2 + 1;

    // 2. Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // 3. Find intersecting objects (pieces and squares)
    const interactableObjects = scene.children.filter(obj => obj.isPiece || obj.isSquare);
    const intersects = raycaster.intersectObjects(interactableObjects, true);

    if (intersects.length > 0) {
        let clickedObject = intersects[0].object;
        
        while (!clickedObject.isPiece && !clickedObject.isSquare && clickedObject.parent) {
            clickedObject = clickedObject.parent;
        }

        if (clickedObject.isPiece) {
            // Case 1: Clicked a piece
            
            // NEW CHECK: Prevent selecting a piece that doesn't belong to the user's role
            if (clickedObject.pieceColor.charAt(0) !== userRole) {
                 document.getElementById('status-message').textContent = `You can only move your own (${userRole === 'w' ? 'White' : 'Black'}) pieces.`;
                 highlightPiece(null);
                 return;
            }
            
            highlightPiece(clickedObject);
        } else if (clickedObject.isSquare && selectedPiece) {
            // Case 2: Clicked a square with a piece already selected
            const sourceSquare = selectedPiece.userData.algebraic;
            const targetSquare = clickedObject.userData.algebraic;

            // Attempt to move using chess.js
            const move = game.move({ 
                from: sourceSquare, 
                to: targetSquare,
                promotion: 'q' // Always promote to queen for simplicity initially
            });

            if (move) {
                // Move is VALID.
                const newFen = game.fen();
                updateBoardFromFEN(newFen); // Redraw entire board based on new FEN
                
                // Update Firebase state (Crucial for multiplayer)
                if (window.updateGameInFirebase) {
                    window.updateGameInFirebase(newFen);
                }

                document.getElementById('status-message').textContent = 
                    `Move: ${move.san}. ${game.turn() === 'w' ? 'White' : 'Black'}'s turn.`;
                
            } else {
                // Move is INVALID.
                document.getElementById('status-message').textContent = 
                    `Invalid move from ${sourceSquare} to ${targetSquare}.`;
            }
            highlightPiece(null); // Deselect piece after move attempt
            
        } else {
            // Case 3: Clicked an empty square without a selected piece
            highlightPiece(null);
        }
    } else {
        // Clicked outside the board/pieces
        highlightPiece(null);
    }
}

/**
 * Event handler for mouse click (desktop).
 */
function onClick(event) {
    // If controls are being dragged, ignore the click as a selection/move
    if (controls.enabled && controls.isDragging) return; 
    handleClick(event.clientX, event.clientY);
}

/**
 * Event handler for touch end (mobile tap).
 */
function onTouchend(event) {
    event.preventDefault(); 
    const touch = event.changedTouches[0];
    
    // Small delay to ensure OrbitControls finishes its drag inertia, then process click
    setTimeout(() => {
        handleClick(touch.clientX, touch.clientY);
    }, 100); 
}

/**
 * Handles touch events to prevent default browser behavior and ensure smooth 3D interaction.
 */
function onTouchStart(event) {
    if (event.touches.length > 0) {
        // Prevent screen scrolling when interacting with 3D canvas
        event.preventDefault(); 
    }
}


// Start the application after the window loads
window.onload = function () {
    init();
    
    // The animate() function is defined near the top, so this call is safe.
    animate(); 

    // --- Attach event listeners to the renderer's DOM element for reliable interaction ---
    window.addEventListener('resize', onWindowResize, false);
    
    // We must wait for init() to run and renderer to be created before accessing renderer.domElement
    if (renderer && renderer.domElement) {
        renderer.domElement.addEventListener('touchstart', onTouchStart, false); 
        renderer.domElement.addEventListener('click', onClick, false); 
        renderer.domElement.addEventListener('touchend', onTouchend, false); 
    } else {
        // Fallback for older browsers or quick loading situations
        window.addEventListener('touchstart', onTouchStart, false);
        window.addEventListener('click', onClick, false);
        window.addEventListener('touchend', onTouchend, false);
    }
    // --------------------------------------------------------------------------
}
