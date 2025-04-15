# app/routes.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.model import load_model, predict_probability

router = APIRouter()

# Define a Pydantic model for validation of input trade data
class Trade(BaseModel):
    timestamp: str
    entry_price: float
    exit_price: float = None  # might not be known in advance
    stop_loss: float
    take_profit: float
    features: dict
    result: str = None  # Optional, used during training/testing

# Load the model once at startup
global_model = load_model()

@router.post("/predict")
def predict(trade: Trade):
    if global_model is None:
        raise HTTPException(status_code=500, detail="Model not available. Train the model first.")
    
    prob = predict_probability(global_model, trade.dict())
    return {"success_probability": prob}
