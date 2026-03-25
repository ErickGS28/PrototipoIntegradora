

ERRORES:


backend/apps/attendance/tasks.py
Refactor this function to reduce its Cognitive Complexity from 36 to the 15 allowed.
Adaptability
Maintainability
4High

brain-overload+
Open
Not assigned
L35
26min effort
8 days ago
backend/apps/fatigue/tasks.py
Refactor this function to reduce its Cognitive Complexity from 74 to the 15 allowed.
Adaptability
Maintainability
4High

brain-overload+
Open
Not assigned
L39
1h4min effort
8 days ago
Refactor this function to reduce its Cognitive Complexity from 64 to the 15 allowed.
Adaptability
Maintainability
4High

brain-overload+
Open
Not assigned
L265
54min effort
8 days ago
Replace the unused local variable "label" with "_".
Intentionality
Maintainability
3Low

unused+
Open
Not assigned
L356
5min effort
8 days ago
backend/apps/reports/views.py
Define a constant instead of duplicating this literal 'text/html; charset=utf-8' 3 times.
Adaptability
Maintainability
4High

design+
Open
Not assigned
L43
6min effort
8 days ago
backend/apps/users/serializers.py
"password" detected here, review this potentially hard-coded credential.
Responsibility
Security
1Blocker

cwe+
Open
Not assigned
L16
30min effort
14 days ago


backend/apps/users/serializers.py

model = User


        fields = ('username', 'password', 'password2', 'name')




    def validate(self, attrs):


        if attrs['password'] != attrs['password2']:


            raise serializers.ValidationError({'password': 'Las contrasenas no coinciden.'})
"password" detected here, review this potentially hard-coded credential.


        return attrs




    def create(self, validated_data):


        validated_data.pop('password2')


        user = User.objects.create_user(


            username=validated_data['username'],


            password=validated_data['password'],


            name=validated_data.get('name', ''),


            role=User.ROLE_MAESTRO,