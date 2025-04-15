# app/model.py

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import pickle
from app.preprocessing import prepare_features

MODEL_PATH = "models/model.pkl"

def train_model(df: pd.DataFrame):
    X = prepare_features(df)
    y = df['result']
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    # Optionally evaluate model performance
    score = model.score(X_test, y_test)
    print(f"Model accuracy: {score:.2f}")
    
    save_model(model)
    return model

def save_model(model):
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(model, f)
    print(f"Model saved at {MODEL_PATH}")

def load_model():
    try:
        with open(MODEL_PATH, 'rb') as f:
            model = pickle.load(f)
        print("Model loaded successfully")
        return model
    except FileNotFoundError:
        print("Model file not found. Please train the model first.")
        return None

def predict_probability(model, trade: dict) -> float:
    # Prepare a single trade into a DataFrame row using the same features
    import pandas as pd
    # Assume that trade is a dictionary with keys similar to our JSON
    df_features = pd.DataFrame([trade['features']])
    # Ensure additional required features are there
    df_features['entry_price'] = trade['entry_price']
    df_features['stop_loss'] = trade['stop_loss']
    df_features['take_profit'] = trade['take_profit']
    
    # Predict the probability of a win (label 1)
    prob = model.predict_proba(df_features)[0][1]
    return prob
    