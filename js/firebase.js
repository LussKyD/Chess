import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";

// Global variables provided by the environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let db, auth, userId = 'loading...';

// Mandatory Firebase setup and error handling
if (Object.keys(firebaseConfig).length > 0) {
    setLogLevel('Debug');
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    
    onAuthStateChanged(auth, async (user) => {
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
    onSnapshot(gameRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("Current game state from Firestore:", data);
            
            // TODO: Add logic here to update the 3D board based on data.boardState
            document.getElementById('status-message').textContent = 
                `Game Loaded! Status: ${data.status || 'Active'}. Current Turn: ${data.turn || 'White'}`;
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
    
    const initialBoardState = {
        boardState: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        turn: 'White',
        players: { white: userId, black: 'Awaiting Player' },
        status: 'Waiting for opponent'
    };
    try {
        await setDoc(getGameDocRef(), initialBoardState);
        console.log("New game initialized!");
    } catch (error) {
        console.error("Error initializing new game:", error);
    }
}
