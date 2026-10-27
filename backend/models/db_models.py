from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="Society Manager", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    societies = relationship("Society", back_populates="user", cascade="all, delete-orphan")


class Society(Base):
    __tablename__ = "societies"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name = Column(String, nullable=False)
    pincode = Column(String, nullable=False)
    num_flats = Column(Integer, nullable=False)
    occupants = Column(Float, default=3.5, nullable=False)
    roof_surface_type = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="societies")
    billing_entries = relationship("BillingEntry", back_populates="society", cascade="all, delete-orphan")
    analyses = relationship("SocietyAnalysis", back_populates="society", cascade="all, delete-orphan")


class BillingEntry(Base):
    __tablename__ = "billing_entries"

    id = Column(Integer, primary_key=True, index=True)
    society_id = Column(Integer, ForeignKey("societies.id", ondelete="CASCADE"), nullable=False)
    month = Column(Integer, nullable=False)  # 1 to 12
    year = Column(Integer, nullable=False)
    municipal_bill = Column(Float, nullable=True)
    municipal_volume_kl = Column(Float, nullable=True)
    tankers = Column(Integer, nullable=True)
    cost_per_tanker = Column(Float, nullable=True)
    tanker_capacity_l = Column(Float, nullable=True)
    borewell_volume_kl = Column(Float, nullable=True)

    society = relationship("Society", back_populates="billing_entries")


class SocietyAnalysis(Base):
    __tablename__ = "society_analyses"

    id = Column(Integer, primary_key=True, index=True)
    society_id = Column(Integer, ForeignKey("societies.id", ondelete="CASCADE"), nullable=False)
    estimated_capex = Column(Float, nullable=True)
    annual_yield_l = Column(Float, nullable=True)
    annual_demand_l = Column(Float, nullable=True)
    computed_data = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    society = relationship("Society", back_populates="analyses")
