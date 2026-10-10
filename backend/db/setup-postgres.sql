-- Run once as the postgres superuser:  psql -U postgres -f backend/db/setup-postgres.sql
CREATE USER aftr WITH PASSWORD 'aftr';
CREATE DATABASE aftr OWNER aftr;
CREATE DATABASE aftr_test OWNER aftr;
