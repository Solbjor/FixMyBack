source .venv/bin/activate
python -m pip install -r requirements.txt

# for stream mode
python main.py --stream --socket http://localhost:4000