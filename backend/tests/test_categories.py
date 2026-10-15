from app.services.categories import role_category


def test_role_category_by_title_and_skills():
    assert role_category("Senior Machine Learning Engineer") == "ML / AI Engineer"
    assert role_category("Junior ML Engineer") == "ML / AI Engineer"
    assert role_category("Data Scientist") == "Data Scientist"
    assert role_category("Data Engineer") == "Data Engineer"
    assert role_category("Business Analyst") == "Data / BI Analyst"
    assert role_category("Backend Developer") == "Backend / Full-stack"
    assert role_category("DevOps Engineer") == "DevOps / Cloud"
    assert role_category("HR Manager") == "Other"
    assert role_category("Consultant", ["PyTorch", "Deep Learning", "Python"]) == "ML / AI Engineer"
    assert role_category("", []) == "Other"
