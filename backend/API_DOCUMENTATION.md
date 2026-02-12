# Player Search API Documentation

This backend provides player search and AI scouting report functionality, pulling data directly from Supabase (similar to my-app but as backend endpoints).

## Base URL
- Development: `http://localhost:5001/api`
- Production: Your deployed backend URL

---

## 🔍 Player Search Endpoints

### 1. Search Players
Search for NCAA Division I basketball players by name.

**Endpoint:** `GET /api/players/search`

**Query Parameters:**
- `query` (string, optional): Player name to search for (uses case-insensitive partial matching)
- `limit` (number, optional): Maximum number of results to return (default: 50)

**Example Requests:**
```bash
# Get initial 50 players (no search query)
GET http://localhost:5001/api/players/search

# Search for players named "John"
GET http://localhost:5001/api/players/search?query=john

# Search with custom limit
GET http://localhost:5001/api/players/search?query=smith&limit=100
```

**Response:**
```json
{
  "players": [
    {
      "unique_id": "player-123",
      "name_split": "John Smith",
      "team": "Duke",
      "position": "Guard",
      "league": "ACC",
      "class": "Junior"
    }
  ],
  "count": 1
}
```

**Frontend Usage Example:**
```javascript
// Fetch initial players
const loadPlayers = async (searchQuery = '') => {
  try {
    const params = new URLSearchParams();
    if (searchQuery) params.append('query', searchQuery);
    params.append('limit', '50');
    
    const response = await fetch(`http://localhost:5001/api/players/search?${params}`);
    const data = await response.json();
    
    setPlayers(data.players);
    console.log(`Found ${data.count} players`);
  } catch (error) {
    console.error('Error loading players:', error);
  }
};
```

---

### 2. Get Player Details
Get detailed statistics for a specific player by their unique ID.

**Endpoint:** `GET /api/players/:id`

**URL Parameters:**
- `id` (string, required): Player's unique_id

**Example Request:**
```bash
GET http://localhost:5001/api/players/player-123
```

**Response:**
```json
{
  "player": {
    "unique_id": "player-123",
    "name_split": "John Smith",
    "team": "Duke",
    "position": "Guard",
    "league": "ACC",
    "class": "Junior",
    "pts_g": 18.5,
    "reb_g": 4.2,
    "ast_g": 5.8,
    "fg": 0.456,
    "c_3pt": 0.389,
    "ft": 0.842,
    "stl_g": 1.8,
    "blk_g": 0.4,
    "to_g": 2.1,
    "min_g": 32.5,
    "g": 30,
    "c_2pt": 0.512,
    "efg": 0.523,
    "ts": 0.587,
    "usg": 0.285,
    "ppp": 1.12,
    "orb_g": 0.8,
    "drb_g": 3.4,
    "pf_g": 2.3,
    "a_to": 2.76
  }
}
```

**Frontend Usage Example:**
```javascript
const loadPlayerDetails = async (playerId) => {
  try {
    const response = await fetch(`http://localhost:5001/api/players/${playerId}`);
    const data = await response.json();
    
    setPlayer(data.player);
  } catch (error) {
    console.error('Error loading player details:', error);
  }
};
```

---

## 🏀 AI Scouting Report Endpoint

### 3. Generate AI Scouting Report
Generate an AI-powered scouting report for a player using the configured provider from `.env` (`LLM_PROVIDER`).

**Endpoint:** `POST /api/scouting/generate`

**Request Body:**
```json
{
  "name": "John Smith",
  "team": "Duke",
  "position": "Guard",
  "class": "Junior",
  "pts_g": 18.5,
  "reb_g": 4.2,
  "ast_g": 5.8,
  "fg": 0.456,
  "c_3pt": 0.389,
  "ft": 0.842,
  "stl_g": 1.8,
  "blk_g": 0.4,
  "to_g": 2.1,
  "min_g": 32.5
}
```

**Required Fields:**
- `name` (string): Player's name
- `team` (string): Player's team

**Optional Fields:** All stats fields (if not provided, will show as "N/A" in report)

**Example Request:**
```bash
POST http://localhost:5001/api/scouting/generate
Content-Type: application/json

{
  "name": "John Smith",
  "team": "Duke",
  "position": "Guard",
  "class": "Junior",
  "pts_g": 18.5,
  "reb_g": 4.2,
  "ast_g": 5.8,
  "min_g": 32.5,
  "fg": 0.456,
  "c_3pt": 0.389,
  "ft": 0.842,
  "stl_g": 1.8,
  "blk_g": 0.4,
  "to_g": 2.1
}
```

**Response:**
```json
{
  "description": "**John Smith** is a **high-volume scorer** averaging **18.5 points per game**..."
}
```

**Frontend Usage Example:**
```javascript
const generateScoutingReport = async (player) => {
  setGenerating(true);
  
  try {
    const response = await fetch('http://localhost:5001/api/scouting/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: player.name_split,
        team: player.team,
        position: player.position,
        class: player.class,
        pts_g: player.pts_g,
        reb_g: player.reb_g,
        ast_g: player.ast_g,
        fg: player.fg,
        c_3pt: player.c_3pt,
        ft: player.ft,
        stl_g: player.stl_g,
        blk_g: player.blk_g,
        to_g: player.to_g,
        min_g: player.min_g,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate scouting report');
    }

    const data = await response.json();
    setScoutingReport(data.description);
  } catch (error) {
    console.error('Error generating report:', error);
  } finally {
    setGenerating(false);
  }
};
```

---

## 📊 Complete Frontend Example

Here's a complete React component example using these endpoints:

```jsx
import { useState, useEffect } from 'react';

export default function PlayerSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [scoutingReport, setScoutingReport] = useState('');
  const [loading, setLoading] = useState(false);

  // Search players
  useEffect(() => {
    const timer = setTimeout(() => {
      loadPlayers(searchQuery);
    }, 300); // Debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadPlayers = async (query) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (query) params.append('query', query);
      
      const response = await fetch(
        `http://localhost:5001/api/players/search?${params}`
      );
      const data = await response.json();
      setPlayers(data.players);
    } catch (error) {
      console.error('Error loading players:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load player details
  const loadPlayerDetails = async (playerId) => {
    try {
      const response = await fetch(
        `http://localhost:5001/api/players/${playerId}`
      );
      const data = await response.json();
      setSelectedPlayer(data.player);
    } catch (error) {
      console.error('Error loading player:', error);
    }
  };

  // Generate AI scouting report
  const generateReport = async () => {
    if (!selectedPlayer) return;
    
    try {
      const response = await fetch(
        'http://localhost:5001/api/scouting/generate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: selectedPlayer.name_split,
            team: selectedPlayer.team,
            position: selectedPlayer.position,
            class: selectedPlayer.class,
            pts_g: selectedPlayer.pts_g,
            reb_g: selectedPlayer.reb_g,
            ast_g: selectedPlayer.ast_g,
            fg: selectedPlayer.fg,
            c_3pt: selectedPlayer.c_3pt,
            ft: selectedPlayer.ft,
            stl_g: selectedPlayer.stl_g,
            blk_g: selectedPlayer.blk_g,
            to_g: selectedPlayer.to_g,
            min_g: selectedPlayer.min_g,
          }),
        }
      );
      const data = await response.json();
      setScoutingReport(data.description);
    } catch (error) {
      console.error('Error generating report:', error);
    }
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Search players..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      
      {loading && <p>Loading...</p>}
      
      <div>
        {players.map((player) => (
          <div
            key={player.unique_id}
            onClick={() => loadPlayerDetails(player.unique_id)}
          >
            <h3>{player.name_split}</h3>
            <p>{player.team} - {player.position}</p>
          </div>
        ))}
      </div>
      
      {selectedPlayer && (
        <div>
          <h2>{selectedPlayer.name_split}</h2>
          <p>PPG: {selectedPlayer.pts_g}</p>
          <button onClick={generateReport}>
            Generate AI Scouting Report
          </button>
          {scoutingReport && <div>{scoutingReport}</div>}
        </div>
      )}
    </div>
  );
}
```

---

## 🔒 Error Handling

All endpoints return appropriate HTTP status codes:

- `200` - Success
- `400` - Bad Request (missing required parameters)
- `404` - Not Found (player doesn't exist)
- `500` - Internal Server Error

**Error Response Format:**
```json
{
  "error": "Error message describing what went wrong"
}
```

---

## ⚙️ Environment Variables Required

Make sure these are set in your `.env` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_key
GEMINI_API_KEY=your_gemini_api_key
GEMINI_CHAT_MODEL=gemini-2.5-flash
```

---

## 🚀 Testing the API

You can test the endpoints using curl:

```bash
# Test player search
curl "http://localhost:5001/api/players/search?query=john"

# Test player details
curl "http://localhost:5001/api/players/player-123"

# Test scouting report generation
curl -X POST "http://localhost:5001/api/scouting/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith",
    "team": "Duke",
    "position": "Guard",
    "pts_g": 18.5,
    "reb_g": 4.2,
    "ast_g": 5.8
  }'
```
