from dotenv import load_dotenv
load_dotenv()

from services.semantic_matcher import compute_hybrid_match

job_web = {
    "title": "Web Developer",
    "description": "We need a web developer with React, JavaScript, Node.js, Express, MongoDB and REST API experience.",
    "skillsRequired": ["React", "JavaScript", "Node.js", "Express", "MongoDB", "REST API"],
    "qualification": "Bachelor in Computer Science",
    "experience": "1 year",
    "careerLevel": "Entry Level",
    "location": "Lahore",
    "rateSkills": {
        "React": "Must Have",
        "JavaScript": "Must Have",
        "Node.js": "Must Have",
        "Express": "Must Have",
        "MongoDB": "Must Have",
        "REST API": "Nice to Have"
    }
}

resume_good = {
    "scoringText": """
    SUMMARY
    MERN stack developer with React, Node.js, Express, MongoDB experience.
    PROJECTS
    Built e-commerce website with React, Node, Express, MongoDB.
    EXPERIENCE
    Frontend Developer internship using React and REST APIs.
    """,
    "structured": {
        "skills": ["React", "JavaScript", "Node.js", "Express", "MongoDB", "REST API"],
        "experience": [
            {
                "title": "Frontend Developer Intern",
                "company": "ABC",
                "description": "Built React pages and integrated REST APIs."
            }
        ],
        "projects": [
            {
                "name": "MERN E-commerce",
                "description": "Built full stack ecommerce app",
                "technologies": ["React", "Node.js", "Express", "MongoDB"]
            }
        ],
        "education": [
            {"degree": "Bachelor of Science in Computer Science"}
        ],
        "languages": []
    }
}

resume_bad = {
    "scoringText": """
    SUMMARY
    Data entry operator with typing, excel and office documentation experience.
    EXPERIENCE
    Data Entry Operator handling records and spreadsheets.
    """,
    "structured": {
        "skills": ["MS Excel", "Typing Speed", "Data Entry", "MS Word"],
        "experience": [
            {
                "title": "Data Entry Operator",
                "company": "XYZ",
                "description": "Handled spreadsheets, typing and data records."
            }
        ],
        "projects": [],
        "education": [
            {"degree": "Intermediate"}
        ],
        "languages": []
    }
}

resume_fresher = {
    "scoringText": """
    SUMMARY
    Final year CS student interested in web development.
    PROJECTS
    MERN authentication project, React dashboard, Node REST API.
    """,
    "structured": {
        "skills": ["React", "JavaScript", "Node.js", "MongoDB"],
        "experience": [],
        "projects": [
            {
                "name": "MERN Auth System",
                "description": "Authentication system with JWT and email verification",
                "technologies": ["React", "Node.js", "Express", "MongoDB", "JWT"]
            },
            {
                "name": "Admin Dashboard",
                "description": "Dashboard in React with charts and API integration",
                "technologies": ["React", "JavaScript", "REST API"]
            }
        ],
        "education": [
            {"degree": "Bachelor of Science in Computer Science"}
        ],
        "languages": []
    }
}

resume_mixed = {
    "scoringText": """
    SUMMARY
    Office assistant with some knowledge of React.
    EXPERIENCE
    Office Assistant managing records and customer support.
    """,
    "structured": {
        "skills": ["React", "MS Office", "Customer Support"],
        "experience": [
            {
                "title": "Office Assistant",
                "company": "Office Co",
                "description": "Managed records, calls and office files."
            }
        ],
        "projects": [],
        "education": [
            {"degree": "Bachelor of Arts"}
        ],
        "languages": []
    }
}

tests = [
    ("GOOD MATCH", resume_good),
    ("BAD MATCH", resume_bad),
    ("FRESHER RELEVANT", resume_fresher),
    ("MIXED CASE", resume_mixed),
]

for label, resume in tests:
    result = compute_hybrid_match(job_web, resume)
    print("\n" + "=" * 70)
    print(label)
    print("final_score:", result["final_score"])
    print("rule_score:", result["rule_score"])
    print("semantic_score:", result["semantic_score"])
    print("similarity:", result["similarity"])
    print("breakdown:", result["breakdown"])