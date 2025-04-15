# Trade Prediction Service

This service loads historical trade data, clusters the trades into winning and losing groups, trains a machine learning model using a RandomForestClassifier, and provides an API endpoint to predict the probability of success for a new trade.

## Setup

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
