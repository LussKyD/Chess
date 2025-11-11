import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";

// Global variables provided by the environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let db, auth, userId = 'loading...';
window.currentUserRole = null; // NEW: Global variable to store the player's assigned color ('w' or 'b')

// Mandatory Firebase setup and error handling
if (Object.keys(firebaseConfig).length > 0) {
    setLogLevel('Debug');
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    
    onAuthStateChanged(auth, async (user) => {
        // ... (Authentication logic remains the same) ...
        if (user) {
            userId = user.uid;
            document.getElementById('user-id-display').textContent = 'User ID: ' + userId;
            window.loadGameState(); // Trigger game state loading after successful auth
        } else if (initialAuthToken) {
            try {
                await signInWithCustomToken(auth, initialAuthToken);
            } catch (error) {
                console.error("Error signing in with custom token:", error);
                await signInAnonymously(auth);
            }
        } else {
            try {
                const userCredential = await signInAnonymously(auth);
                userId = userCredential.user.uid;
                document.getElementById('user-id-display').textContent = 'User ID: ' + userId;
                window.loadGameState(); // Trigger game state loading
            } catch (error) {
                console.error("Anonymous sign-in failed:", error);
                userId = crypto.randomUUID();
                document.getElementById('user-id-display').textContent = 'User ID (Fallback): ' + userId;
            }
        }
    });
} else {
     document.getElementById('user-id-display').textContent = 'User ID: FIREBASE ERROR';
}

// --- Game State Functions (Exposed to the window) ---

const gameId = 'mainCastleGame'; 
const getGameDocRef = () => doc(db, 'artifacts', appId, 'public', 'data', 'chessGames', gameId);

/**
 * Loads game state using a real-time listener (onSnapshot).
 */
window.loadGameState = function() {
    if (!db || userId === 'loading...' || userId.includes('ERROR')) return;

    const gameRef = getGameDocRef();
    onSnapshot(gameRef, async (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("Current game state from Firestore:", data);
            
            // NEW LOGIC: Player Role Assignment and Status Update
            let updateNeeded = false;
            let players = data.players || { white: null, black: null };

            // 1. Assign Role if user isn't already assigned
            if (players.white === userId) {
                window.currentUserRole = 'w';
            } else if (players.black === userId) {
                window.currentUserRole = 'b';
            } else if (!players.white) {
                // First player gets White
                players.white = userId;
                window.currentUserRole = 'w';
                updateNeeded = true;
                console.log("Assigned role: White");
            } else if (!players.black && players.white !== userId) {
                // Second player gets Black
                players.black = userId;
                window.currentUserRole = 'b';
                updateNeeded = true;
                console.log("Assigned role: Black");
            }

            // 2. Update Firestore if a new role was assigned
            if (updateNeeded) {
                try {
                    await updateDoc(gameRef, { players: players, status: 'Active' });
                    // No need to redraw here, onSnapshot will trigger again with new data
                } catch (error) {
                    console.error("Error assigning player role:", error);
                }
            }
            
            // 3. Update UI based on data and assigned role
            if (window.updateBoardFromFEN) {
                window.updateBoardFromFEN(data.boardState);
            }
            
            const roleMessage = window.currentUserRole ? `You are ${window.currentUserRole === 'w' ? 'White' : 'Black'}.` : 'You are an Observer.';
            const turnMessage = data.turn === 'White' ? "White's Turn" : "Black's Turn";
            
            document.getElementById('status-message').textContent = 
                `${roleMessage} | ${turnMessage} | Game Status: ${data.status || 'Active'}`;
                
            // Expose the current game turn to main.js for move restriction
            window.currentGameTurn = data.turn === 'White' ? 'w' : 'b'; 

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
    if (!db || userId === 'loading...' || userId.includes('ERROR')) return;
    
    // Check if a game already exists before overwriting
    const docSnap = await getDoc(getGameDocRef());
    if (docSnap.exists() && docSnap.data().status !== 'Finished') {
        console.log("Game already exists and is active. Reloading state instead of overwriting.");
        return;
    }

    // Assign current user as White upon initialization
    const initialBoardState = {
        boardState: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Starting FEN
        turn: 'White',
        players: { white: userId, black: null }, // Initialize with only White assigned
        status: 'Waiting for opponent'
    };
    try {
        await setDoc(getGameDocRef(), initialBoardState);
        window.currentUserRole = 'w'; // Set role locally immediately
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
    if (!db || userId === 'loading...' || userId.includes('ERROR')) return;

    const gameRef = getGameDocRef();
    const newTurn = newFen.includes(' w ') ? 'White' : 'Black';

    try {
        await updateDoc(gameRef, {
            boardState: newFen,
            turn: newTurn,
            // You can add logic here to check game.in_checkmate(), game.in_draw(), etc., to update status
        });
        console.log("Game state updated successfully with new FEN.");
    } catch (error) {
        console.error("Error updating game state:", error);
        document.getElementById('status-message').textContent = "ERROR: Failed to save move to Firebase.";
    }
}
