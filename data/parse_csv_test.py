import pandas as pd

def test_parse():
    df = pd.read_csv("data/raw/train_schedule.csv", quotechar="'")
    print(df.columns)
    
    unique_trains = df[['Train No.', 'train Name']].drop_duplicates()
    print(f"Total unique trains: {len(unique_trains)}")
    print(unique_trains.head())

if __name__ == "__main__":
    test_parse()
