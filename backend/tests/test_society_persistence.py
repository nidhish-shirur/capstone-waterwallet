import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import db_models, schemas
from routers.societies import (
    create_society,
    get_billing_entries_from_database,
    get_society,
    list_societies,
    save_billing_entries,
    update_society,
)


class SocietyPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        db_models.Base.metadata.create_all(
            self.engine,
            tables=[
                db_models.User.__table__,
                db_models.Society.__table__,
                db_models.BillingEntry.__table__,
            ],
        )
        self.Session = sessionmaker(bind=self.engine, expire_on_commit=False)
        with self.Session() as db:
            self.user = db_models.User(
                email="manager@example.com",
                hashed_password="test-hash",
            )
            self.other_user = db_models.User(
                email="other@example.com",
                hashed_password="test-hash",
            )
            db.add_all([self.user, self.other_user])
            db.commit()

    def tearDown(self):
        self.engine.dispose()

    def _create_society(self, user=None):
        with self.Session() as db:
            return create_society(
                schemas.SocietyCreate(
                    name="Evergreen Heights",
                    pincode="400071",
                    num_flats=50,
                    occupants=4,
                    roof_surface_type="concrete",
                ),
                db,
                user or self.user,
            )

    def test_created_society_is_available_from_a_new_session(self):
        created = self._create_society()

        with self.Session() as db:
            societies = list_societies(db, self.user)

        self.assertEqual(len(societies), 1)
        self.assertEqual(societies[0].id, created.id)
        self.assertEqual(societies[0].name, "Evergreen Heights")

    def test_billing_entries_are_persisted_and_replaced(self):
        society = self._create_society()
        entries = [
            schemas.BillingEntryCreate(
                month=1,
                year=2026,
                municipal_bill=12000,
                tankers=4,
                cost_per_tanker=1500,
                tanker_capacity_l=10000,
            ),
            schemas.BillingEntryCreate(
                month=2,
                year=2026,
                municipal_bill=12500,
                tankers=3,
                cost_per_tanker=1500,
                tanker_capacity_l=10000,
            ),
        ]

        with self.Session() as db:
            saved = save_billing_entries(society.id, entries, db, self.user)
            self.assertEqual(len(saved), 2)

        replacement = [
            schemas.BillingEntryCreate(
                month=3,
                year=2026,
                municipal_bill=13000,
                tankers=2,
                cost_per_tanker=1500,
                tanker_capacity_l=10000,
            )
        ]
        with self.Session() as db:
            save_billing_entries(society.id, replacement, db, self.user)

        with self.Session() as db:
            persisted = get_billing_entries_from_database(society.id, db, self.user)
            detail = schemas.SocietyDetailResponse.model_validate(
                get_society(society.id, db, self.user)
            )

        self.assertEqual(len(persisted), 1)
        self.assertEqual(persisted[0].month, 3)
        self.assertEqual(persisted[0].municipal_bill, 13000)
        self.assertEqual(len(detail.billing_entries), 1)
        self.assertEqual(detail.billing_entries[0].month, 3)

    def test_society_and_billing_access_is_scoped_to_owner(self):
        society = self._create_society()

        with self.Session() as db:
            self.assertEqual(list_societies(db, self.other_user), [])
            with self.assertRaises(HTTPException) as missing:
                get_society(society.id, db, self.other_user)

        self.assertEqual(getattr(missing.exception, "status_code", None), 404)

    def test_updates_are_persisted(self):
        society = self._create_society()

        with self.Session() as db:
            update_society(
                society.id,
                schemas.SocietyUpdate(name="Evergreen Heights Updated"),
                db,
                self.user,
            )

        with self.Session() as db:
            persisted = get_society(society.id, db, self.user)

        self.assertEqual(persisted.name, "Evergreen Heights Updated")


if __name__ == "__main__":
    unittest.main()
