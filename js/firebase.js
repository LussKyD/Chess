import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";

// Global variables provided by the environment
// NOTE: These variables are left for Canvas compatibility but will be empty/null on GitHub Pages.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let db, auth;
window.currentUserRole = null; // Global variable to store the player's assigned color ('w' or 'b')

// --- OFFLINE MODE SETUP ---
// On GitHub Pages, firebaseConfig will be empty, so we explicitly set the app to offline mode
const isFirebaseConnected = Object.keys(firebaseConfig).length > 0;
let userId = crypto.randomUUID(); // Always generate a UUID as a user ID, regardless of connection status

// If Firebase config is present, proceed with initialization
if (isFirebaseConnected) {
    setLogLevel('Debug');
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    
    // Use onAuthStateChanged for proper authentication only if connected
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
            document.getElementById('user-id-display').textContent = 'User ID: ' + userId;
            window.loadGameState(); // Trigger game state loading after successful auth
        } else if (initialAuthToken) {
            try {
                await signInWithCustomToken(auth, initialAuthToken);
            } catch (error) {
                console.error("Error signing in with custom token, falling back:", error);
                await signInAnonymously(auth);
            }
        } else {
            try {
                await signInAnonymously(auth);
            } catch (error) {
                console.error("Anonymous sign-in failed:", error);
            }
        }
    });
} else {
    // --- Fallback for GitHub Pages / Disconnected Mode ---
    document.getElementById('user-id-display').textContent = 'User ID (Offline): ' + userId;
    // Set a timeout to ensure main.js is loaded and can handle loadGameState
    setTimeout(() => {
        window.loadGameState(); 
    }, 100); 
}

// --- Game State Functions (Exposed to the window) ---

const gameId = 'mainCastleGame'; 
const getGameDocRef = () => doc(db, 'artifacts', appId, 'public', 'data', 'chessGames', gameId);

/**
 * Loads game state using a real-time listener (onSnapshot) or sets local state if offline.
 */
window.loadGameState = function() {
    // NEW CHECK: Prevent Firestore calls if connection failed
    if (!isFirebaseConnected) {
        console.warn("Skipping loadGameState: Firebase is not connected. Entering Offline Mode.");
        
        // 1. Force the role to White for local testing
        window.currentUserRole = 'w';
        
        // 2. Load the initial board state locally
        if (window.updateBoardFromFEN && window.game) {
             window.game.reset();
             window.updateBoardFromFEN(window.game.fen());
        }
        
        // 3. Update UI status
        document.getElementById('status-message').textContent = 
            'Offline Mode: You are White. Moves will not save or sync.';
            
        return;
    }
    
    // --- ONLINE MODE (Only runs if Firebase is connected) ---
    if (!db || userId === 'loading...') return;

    const gameRef = getGameDocRef();
    onSnapshot(gameRef, async (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("Current game state from Firestore:", data);
            
            // Player Role Assignment and Status Update logic
            let updateNeeded = false;
            let players = data.players || { white: null, black: null };

            // 1. Assign Role
            if (players.white === userId) {
                window.currentUserRole = 'w';
            } else if (players.black === userId) {
                window.currentUserRole = 'b';
            } else if (!players.white) {
                players.white = userId;
                window.currentUserRole = 'w';
                updateNeeded = true;
            } else if (!players.black && players.white !== userId) {
                players.black = userId;
                window.currentUserRole = 'b';
                updateNeeded = true;
            }

            // 2. Update Firestore if a new role was assigned
            if (updateNeeded) {
                try {
                    await updateDoc(gameRef, { players: players, status: 'Active' });
                } catch (error) {
                    console.error("Error assigning player role:", error);
                }
            }
            
            // 3. Update UI based on data and assigned role
            if (window.updateBoardFromFEN) {
                window.updateBoardFromFEN(data.boardState);
            }
            
            const roleMessage = window.currentUserRole ? `You are ${window.currentUserRole === 'w' ? 'White' : 'Black'}.` : 'You are an Observer.';
            const turnMessage = window.game.in_checkmate() ? 'CHECKMATE' : (data.turn === 'White' ? "White's Turn" : "Black's Turn");
            
            document.getElementById('status-message').textContent = 
                `${roleMessage} | ${turnMessage} | Game Status: ${data.status || 'Active'}`;

        } else {
            console.log("No existing game state found. Initializing new game.");
            window.initializeNewGame(); 
        }
    }, (error) => {
        console.error("Error setting up onSnapshot listener:", error);
        document.getElementById('status-message').textContent = 
            `Error loading game: ${error.message}`;
    });
}

/**
 * Initializes a new game state in Firestore.
 */
window.initializeNewGame = async function() {
    if (!isFirebaseConnected) {
        // In offline mode, reset the local game state only
        window.game.reset();
        window.updateBoardFromFEN(window.game.fen());
        document.getElementById('status-message').textContent = 'Offline Mode: Local game reset. You are White.';
        return;
    }
    
    // --- ONLINE MODE (Only runs if Firebase is connected) ---
    if (!db || userId === 'loading...') return;
    
    const docSnap = await getDoc(getGameDocRef());
    if (docSnap.exists() && docSnap.data().status !== 'Finished') {
        console.log("Game already exists and is active. Reloading state instead of overwriting.");
        return;
    }

    const initialBoardState = {
        boardState: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        turn: 'White',
        players: { white: userId, black: null },
        status: 'Waiting for opponent'
    };
    try {
        await setDoc(getGameDocRef(), initialBoardState);
        window.currentUserRole = 'w';
        console.log("New game initialized! User is White.");
    } catch (error) {
        console.error("Error initializing new game:", error);
    }
}

/**
 * NEW: Updates the FEN string in Firestore after a valid move.
 * @param {string} newFen - The new FEN string after the move.
 */
window.updateGameInFirebase = async function(newFen) {
    if (!isFirebaseConnected) {
        // Do nothing in offline mode, move is already applied locally
        document.getElementById('status-message').textContent = 'Offline Mode: Move executed, but not synced to Firebase.';
        return;
    }
    
    // --- ONLINE MODE (Only runs if Firebase is connected) ---
    if (!db || userId === 'loading...') return;

    const gameRef = getGameDocRef();
    const newTurn = newFen.includes(' w ') ? 'White' : 'Black';

    try {
        await updateDoc(gameRef, {
            boardState: newFen,
            turn: newTurn,
        });
        console.log("Game state updated successfully with new FEN.");
    } catch (error) {
        console.error("Error updating game state:", error);
        document.getElementById('status-message').textContent = "ERROR: Failed to save move to Firebase.";
    }
}
