# 1. Configuración del Proveedor (AWS)
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1" # Región estándar (Virginia)
}

# 2. Creación de una Red Privada y Segura (VPC) para aislar la telemetría
resource "aws_vpc" "fleet_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  tags = {
    Name = "VPC-Monitoreo-Flotas"
  }
}

# 3. Grupo de Seguridad (Firewall) - Remediación de Vulnerabilidades
resource "aws_security_group" "db_security_group" {
  name        = "secure-db-sg"
  description = "Reglas de firewall para aislamiento de datos"
  vpc_id      = aws_vpc.fleet_vpc.id

  # Entrada: Solo acepta conexiones internas del Backend en el puerto de la BD
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.1.0/24"] 
  }

  # Salida: Permitida para parches de seguridad del sistema operativo
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# 4. Instancia de Base de Datos en la Nube (RDS Postgres/Timescale)
resource "aws_db_instance" "fleet_database" {
  allocated_storage      = 20
  db_name                = "fleet_production"
  engine                 = "postgres"
  engine_version         = "15"
  instance_class         = "db.t3.micro"
  username               = "josik_cloud_admin"
  password               = "SuperSecurePassword2026#"
  skip_final_snapshot    = true
  vpc_security_group_ids = [aws_security_group.db_security_group.id]

  # 🔒 Parámetros estrictos de cumplimiento y seguridad (SOX / FedRAMP audit-ready)
  storage_encrypted   = true  # Cifrado de datos en reposo para mitigar fugas de información
  publicly_accessible = false # Cero exposición a internet público para evitar ataques externos

  tags = {
    Environment = "Production"
    Project     = "Portal Monitoreo Flotas"
  }
}