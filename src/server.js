const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Route to save results - exactly as in original application
app.post('/api/save-results', (req, res) => {
  const { reps, goal } = req.body;
  
  let data = [[]];
  const resultsPath = path.join(__dirname, '../public/results.json');
  
  // Try to read existing results
  try {
    if (fs.existsSync(resultsPath)) {
      const fileContent = fs.readFileSync(resultsPath, 'utf8');
      if (fileContent) {
        data = JSON.parse(fileContent);
      }
    }
  } catch (error) {
    console.error('Error reading results file:', error);
  }
  
  // Append new results - exactly as in original application
  data[0].push(reps);
  data[0].push(goal);
  
  // Save updated results
  try {
    fs.writeFileSync(resultsPath, JSON.stringify(data));
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error saving results:', error);
    res.status(500).json({ success: false, error: 'Failed to save results' });
  }
});

// Route to get results
app.get('/api/get-results', (req, res) => {
  const resultsPath = path.join(__dirname, '../public/results.json');
  
  try {
    if (fs.existsSync(resultsPath)) {
      const fileContent = fs.readFileSync(resultsPath, 'utf8');
      if (fileContent) {
        const data = JSON.parse(fileContent);
        res.status(200).json(data);
      } else {
        res.status(200).json([[]]);
      }
    } else {
      res.status(200).json([[]]);
    }
  } catch (error) {
    console.error('Error reading results file:', error);
    res.status(500).json({ error: 'Failed to read results' });
  }
});

// Start server - listen on all interfaces (0.0.0.0) for external access
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
