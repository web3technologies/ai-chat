{{- define "ai-chat.databaseUrl" -}}
postgresql://{{ .Values.postgres.user }}:{{ .Values.postgres.password }}@postgres:5432/{{ .Values.postgres.database }}
{{- end -}}

{{- define "ai-chat.waitForSchema" -}}
- name: wait-for-schema
  image: {{ .Values.image }}
  imagePullPolicy: {{ .Values.imagePullPolicy }}
  workingDir: /app
  command: ["sh", "-c"]
  args:
    - |
      until ./node_modules/.bin/prisma migrate status; do
        echo "waiting for migrations"
        sleep 2
      done
  env:
    - name: HOME
      value: /tmp
    - name: DATABASE_URL
      value: {{ include "ai-chat.databaseUrl" . | quote }}
{{- end -}}
