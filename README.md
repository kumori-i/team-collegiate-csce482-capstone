# team-collegiate-csce482-capstone

TEAM: Ethan Rendell, Harrison Ko, Joshua George, Robert Stacks

## Authentication System Setup

This project includes a complete authentication system with MongoDB, login, and registration functionality.

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn
- Ollama (for local AI chat/embeddings)

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the `backend` directory with the following variables:
   ```
   MONGO_URI=your_mongodb_connection_string_here
   JWT_SECRET=your_jwt_secret_key_here
   PORT=5001
   ```

   - **MONGO_URI**: Your MongoDB connection string (e.g., `mongodb://localhost:27017/your-database-name` or MongoDB Atlas connection string)
   - **JWT_SECRET**: A random secret key for signing JWT tokens (you can generate one using: `openssl rand -base64 32`)
   - **PORT**: Server port (optional, defaults to 5001)
   
   **Note**: Port 5000 is commonly used by Apple's AirPlay service on macOS. If you encounter connection issues, use port 5001 or another available port.

4. Start the backend server:
   ```bash
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Create a `.env` file in the `frontend` directory:
   ```
   REACT_APP_API_URL=http://localhost:5001/api
   ```
   Note: If not set, it defaults to `http://localhost:5001/api`

4. Start the frontend development server:
   ```bash
   npm start
   ```

### AI Chat (RAG) Setup

The chat page uses a local RAG pipeline powered by Ollama. CSV files under `data/` are embedded into vectors and queried at runtime.

1. Install and start Ollama:
   ```bash
   ollama serve
   ```

2. Pull the models:
   ```bash
   ollama pull llama3.1
   ollama pull nomic-embed-text
   ```

3. Put your CSV files in the `data/` directory.
   - Example file: `data/sample_basketball_stats.csv`

4. Build the vector index:
   ```bash
   cd backend
   npm install
   npm run build-index
   ```

5. Start the backend and frontend as usual.

Optional environment variables (backend):
```
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
OLLAMA_EMBED_MODEL=nomic-embed-text
VECTOR_INDEX_PATH=../data/vector_index.json
ROWS_PER_CHUNK=1
RAG_TOP_K=4
```

### Features

- **User Registration**: Create new accounts with email, password, and role (scout/coach)
- **User Login**: Authenticate users and receive JWT tokens
- **Password Security**: Passwords are hashed using bcrypt
- **JWT Authentication**: Secure token-based authentication
- **Modern UI**: Clean, responsive design with form validation

### API Endpoints

- `POST /api/auth/register` - Register a new user
  - Body: `{ email, password, role }`
  
- `POST /api/auth/login` - Login user
  - Body: `{ email, password }`
  - Returns: `{ token }`

- `POST /api/chat` - Ask questions about CSV data
  - Body: `{ message }`
  - Returns: `{ reply, sources }`

- `GET /health` - Health check endpoint
