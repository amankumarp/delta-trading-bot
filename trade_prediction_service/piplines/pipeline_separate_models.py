import os
import json
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import pickle

# ----------------------------
# Configuration & File Paths
# ----------------------------
DATA_PATH = "data/trades.json"
SIDEWAYS_MODEL_PATH = "models/sideways_model.pkl"
VOLATILITY_MODEL_PATH = "models/volatility_model.pkl"

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
    # Flatten nested 'features' dictionary column into separate columns
    features_df = pd.json_normalize(df['features'])
    # Concatenate additional numerical features. Extend with more as needed.
    additional_features = df[['entry_price', 'stop_loss', 'take_profit']]
    return features_df.join(additional_features)

# ----------------------------
# Market Condition Classifier
# ----------------------------
def classify_market_condition(row, threshold: float = 0.02) -> str:
    """
    Classifies a trade as 'sideways' or 'volatile'.
    
    Here, the volatility is a simple measure calculated as the absolute difference 
    between take_profit and stop_loss. If this range is less than the threshold, 
    we consider it sideways. Otherwise, it is volatile.
    
    Adjust the threshold and the measure as appropriate for your data.
    """
    range_val = abs(row['take_profit'] - row['stop_loss'])
    return 'sideways' if range_val < threshold else 'volatile'

def assign_market_condition(df: pd.DataFrame, threshold: float = 0.02) -> pd.DataFrame:
    df['market_condition'] = df.apply(lambda row: classify_market_condition(row, threshold), axis=1)
    return df

# ----------------------------
# Model Training Function
# ----------------------------
def train_model(df: pd.DataFrame) -> RandomForestClassifier:
    X = prepare_features(df)
    y = df['result']
    
    # Split data into training and evaluation sets
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    # Evaluate and report performance
    score = model.score(X_test, y_test)
    print(f"Trained model accuracy: {score:.2f}")
    return model

# ----------------------------
# Model Save/Load Functions
# ----------------------------
def save_model(model, path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        pickle.dump(model, f)
    print(f"Model saved at {path}")

def load_model(path: str):
    try:
        with open(path, 'rb') as f:
            model = pickle.load(f)
        print(f"Loaded model from {path}")
        return model
    except FileNotFoundError:
        print(f"Model file not found at {path}. Please train the model first.")
        return None

# ----------------------------
# Prediction: Get Trade Success Probability
# ----------------------------
def predict_probability(model, trade: dict) -> float:
    """
    Given a loaded model and a trade (as a dictionary), predict the probability of a win.
    """
    # Build a DataFrame row with the same features as used during training.
    features_df = pd.DataFrame([trade['features']])
    features_df['entry_price'] = trade['entry_price']
    features_df['stop_loss'] = trade['stop_loss']
    features_df['take_profit'] = trade['take_profit']
    
    # Return probability of a win (label 1).
    prob = model.predict_proba(features_df)[0][1]
    return prob

# ----------------------------
# Pipeline Execution
# ----------------------------
if __name__ == "__main__":
    # Load data
    print("Loading trade data...")
    df_trades = load_trade_data(DATA_PATH)
    print(f"Loaded {len(df_trades)} trades.")

    # Assign market condition labels based on defined threshold.
    df_trades = assign_market_condition(df_trades, threshold=0.02)
    print("Market condition distribution:")
    print(df_trades['market_condition'].value_counts())

    # Split data into sideways and volatile subsets.
    df_sideways = df_trades[df_trades['market_condition'] == 'sideways']
    df_volatile = df_trades[df_trades['market_condition'] == 'volatile']
    
    # Train models only if there is enough data.
    if not df_sideways.empty:
        print("\nTraining model for sideways markets...")
        sideways_model = train_model(df_sideways)
        save_model(sideways_model, SIDEWAYS_MODEL_PATH)
    else:
        print("Not enough data for sideways market training.")
    
    if not df_volatile.empty:
        print("\nTraining model for volatile markets...")
        volatile_model = train_model(df_volatile)
        save_model(volatile_model, VOLATILITY_MODEL_PATH)
    else:
        print("Not enough data for volatile market training.")
    
    # Example: Prepare a new trade and predict based on its market condition.
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
    
    # Determine market condition for the new trade.
    market_cond = classify_market_condition(example_trade, threshold=0.02)
    print(f"\nPredicted market condition for new trade: {market_cond}")
    
    if market_cond == 'sideways':
        model_to_use = load_model(SIDEWAYS_MODEL_PATH)
    else:
        model_to_use = load_model(VOLATILITY_MODEL_PATH)
    
    if model_to_use:
        prob = predict_probability(model_to_use, example_trade)
        print(f"Predicted probability of success for the new trade: {prob:.2f}")
