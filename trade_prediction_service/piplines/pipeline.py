import os
import json
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import pickle

# ----------------------------
# Configuration & File Paths
# ----------------------------
DATA_PATH = "data/trades.json"
MODEL_PATH = "models/model.pkl"
CLUSTER_MODEL_PATH = "models/cluster_model.pkl"

# ----------------------------
# Utility: Load Trade Data
# ----------------------------
def load_trade_data(file_path: str) -> pd.DataFrame:
    with open(file_path, 'r') as f:
        data = json.load(f)
    df = pd.DataFrame(data)
    # Map trade result from string to binary label (win: 1, loss: 0)
    df['result'] = df['result'].map({'win': 1, 'loss': 0})
    return df

# ----------------------------
# Preprocessing: Prepare Features
# ----------------------------
def prepare_features(df: pd.DataFrame) -> pd.DataFrame:
    # Flatten the nested 'features' dictionary column into separate columns
    features_df = pd.json_normalize(df['features'])
    # Concatenate additional numerical features. You can add more columns as needed.
    additional_features = df[['entry_price', 'stop_loss', 'take_profit']]
    return features_df.join(additional_features)

# ----------------------------
# Clustering: Analyze Trades
# ----------------------------
def cluster_trades(df: pd.DataFrame, n_clusters: int = 3):
    features = prepare_features(df)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(features)
    
    kmeans = KMeans(n_clusters=n_clusters, random_state=42)
    clusters = kmeans.fit_predict(X_scaled)
    df['cluster'] = clusters
    
    # Save clustering model for reference (optional)
    with open(CLUSTER_MODEL_PATH, 'wb') as f:
        pickle.dump((kmeans, scaler), f)
    print(f"Clustering complete. Model saved at {CLUSTER_MODEL_PATH}")
    return df

# ----------------------------
# Model: Train Trade Prediction Model
# ----------------------------
def train_model(df: pd.DataFrame) -> RandomForestClassifier:
    X = prepare_features(df)
    y = df['result']
    
    # Split the data for training and evaluation
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    # Evaluate the model
    score = model.score(X_test, y_test)
    print(f"Model training complete. Accuracy on test data: {score:.2f}")
    return model

# ----------------------------
# Save/Load Model Functions
# ----------------------------
def save_model(model, path: str = MODEL_PATH):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        pickle.dump(model, f)
    print(f"Model saved at {path}")

def load_model(path: str = MODEL_PATH):
    try:
        with open(path, 'rb') as f:
            model = pickle.load(f)
        print("Model loaded successfully.")
        return model
    except FileNotFoundError:
        print("Model file not found. Please train and save the model first.")
        return None

# ----------------------------
# Prediction: Get Trade Success Probability
# ----------------------------
def predict_probability(model, trade: dict) -> float:
    import pandas as pd
    # Prepare feature DataFrame for the incoming trade
    features_df = pd.DataFrame([trade['features']])
    features_df['entry_price'] = trade['entry_price']
    features_df['stop_loss'] = trade['stop_loss']
    features_df['take_profit'] = trade['take_profit']
    
    # Predict the probability of a win (label 1)
    prob = model.predict_proba(features_df)[0][1]
    return prob

# ----------------------------
# Pipeline Execution
# ----------------------------
if __name__ == "__main__":
    # Step 1: Load Data
    print("Loading trade data...")
    df_trades = load_trade_data(DATA_PATH)
    print(f"Loaded {len(df_trades)} trades.")

    # Step 2: (Optional) Cluster Trades for Analysis
    print("Clustering trades for analysis...")
    df_trades = cluster_trades(df_trades, n_clusters=3)
    print("Cluster distribution:")
    print(df_trades['cluster'].value_counts())

    # Step 3: Train the Prediction Model
    print("Training the prediction model...")
    model = train_model(df_trades)

    # Step 4: Save the Trained Model
    save_model(model, MODEL_PATH)
    
    # Example: Predict probability for a new trade (for testing purpose)
    example_trade = {
        "timestamp": "2025-04-16T09:45:00",
        "entry_price": 1.1055,
        "stop_loss": 1.1030,
        "take_profit": 1.1080,
        "features": {
            "indicator1": 0.80,
            "indicator2": 1.15
        }
    }
    
    loaded_model = load_model(MODEL_PATH)
    if loaded_model:
        prob = predict_probability(loaded_model, example_trade)
        print(f"Predicted probability of success for the new trade: {prob:.2f}")
