import re

windows_packages = [
    'win_inet_pton', 'vs2015_runtime', 'vc14_runtime', 'vc', 'ucrt', 
    'mpir', 'mkl_random', 'mkl_fft', 'mkl-service', 'mkl', 
    'intel-openmp', 'icc_rt'
]

with open('requirements.txt', 'r') as f:
    requirements = f.readlines()

cleaned_requirements = []
for req in requirements:
    package_name = re.split('[=<>]', req.strip())[0]
    if package_name not in windows_packages:
        cleaned_requirements.append(package_name)

with open('cleaned_requirements.txt', 'w') as f:
    for req in cleaned_requirements:
        f.write(req + '\n')

print("Cleaned requirements file has been created as 'cleaned_requirements.txt'")