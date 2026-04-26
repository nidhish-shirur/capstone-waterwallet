from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from models.schemas import ReportRequest
from services.pdf_generator import generate_pdf_report
import io

router = APIRouter()


@router.post("/generate")
async def report_generate(payload: ReportRequest):
    """
    Generate and stream a PDF report for the given society analysis.
    Uses WeasyPrint + Jinja2 to render an HTML template to PDF.
    """
    pdf_bytes = await generate_pdf_report(payload)

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="waterwallet-report.pdf"'
        },
    )
