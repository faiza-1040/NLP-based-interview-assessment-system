from services.bm25_search import bm25_rank

jobs = [
    {
        "id": "1",
        "title": "Python Backend Developer",
        "description": "Looking for a backend developer with Python and FastAPI experience",
        "skillsRequired": ["Python", "FastAPI", "MongoDB"],
        "companyName": "TechSoft"
    },
    {
        "id": "2",
        "title": "Frontend Developer",
        "description": "React developer with UI experience",
        "skillsRequired": ["React", "CSS"],
        "companyName": "WebWorks"
    },
    {
        "id": "3",
        "title": "Data Analyst",
        "description": "Excel, SQL, dashboards, reporting",
        "skillsRequired": ["SQL", "Excel"],
        "companyName": "DataCorp"
    }
]

query = "python backend fastapi"
print(bm25_rank(query, jobs))
