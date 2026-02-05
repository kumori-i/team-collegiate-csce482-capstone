# team-collegiate-csce482-capstone

TEAM: Ethan Rendell, Harrison Ko, Joshua George, Robert Stacks

## Authentication System Setup

This project includes a complete authentication system with MongoDB, login, and registration functionality.

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn
- Ollama (for local AI chat/embeddings) or a Gemini API key

### AI Chat (RAG) Setup

The chat page uses a local RAG pipeline powered by Ollama by default. If you provide a Gemini API key, the backend will use Gemini for both embeddings and chat instead.

#### Option A: Use Gemini (API key file, not tracked by git)

Create a `backend/.env.local` file (this is ignored by git) and add:

```
GEMINI_API_KEY=your_gemini_key_here
GEMINI_CHAT_MODEL=gemini-2.5-flash
GEMINI_EMBED_MODEL=gemini-embedding-001
RAG_STRICT=true
LLM_TEMPERATURE=0.2
LLM_TOP_P=0.9
LLM_MAX_TOKENS=512
```

- If `GEMINI_API_KEY` is set, the backend will automatically use Gemini instead of Ollama.
- `RAG_STRICT=true` enforces answers strictly from the provided data context.
- Set `LLM_PROVIDER=ollama` to force Ollama even if a Gemini key is present.

Note: If you switch embedding providers/models, rebuild the vector index so stored embeddings match the provider.

#### Option B: Use Ollama (local)

#### Install Ollama (by OS) (Terminal 1)

- macOS (Homebrew):
  ```bash
  brew install ollama
  ```
- macOS (manual):
  - Download and install from the Ollama website.
- Windows:
  - Download and install from the Ollama website.
- Linux:
  ```bash
  curl -fsSL https://ollama.com/install.sh | sh
  ```

#### Start Ollama and pull models

1. Pull the models:
   ```bash
   ollama pull llama3.1
   ollama pull nomic-embed-text
   ```

2. Start the Ollama server:
   ```bash
   ollama serve
   ```

#### Prepare CSV data and build the index (Terminal 2)

1. Put your CSV files in the `data/` directory.
   - Example file: `data/sample_basketball_stats.csv`

2. Build the vector index:
   ```bash
   cd backend
   npm install
   npm run build-index
   ```

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

### Frontend Setup (Terminal 3)

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

### Cloudflare Deployment

1. Run the following command to deploy to Cloudflare:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
2. Retrieve the tunnel URL from the output and update Google Cloud Platform (GCP) settings to point to it.

### Features

- **User Registration**: Create new accounts with Google OAuth
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
