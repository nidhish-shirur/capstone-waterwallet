from fastapi import HTTPException
from models.schemas import ReportRequest

# ---------------------------------------------------------------------------
# PDF generation is not yet available in this deployment.
#
# WeasyPrint requires GTK3 system-level libraries (libcairo, libpango, etc.)
# which are not installed in the current environment. When those dependencies
# are available, restore the implementation below:
#
#   from pathlib import Path
#   import asyncio
#   from jinja2 import Environment, FileSystemLoader, select_autoescape
#   from weasyprint import HTML
#
#   TEMPLATE_DIR = Path(__file__).parent.parent / "templates"
#
#   async def generate_pdf_report(data: ReportRequest) -> bytes:
#       env = Environment(
#           loader=FileSystemLoader(str(TEMPLATE_DIR)),
#           autoescape=select_autoescape(["html"]),
#       )
#       template = env.get_template("report.html")
#       html_content = template.render(
#           society_name=data.society_name,
#           society=data.society_data,
#           catchment=data.catchment_data,
#           roi=data.roi_data,
#       )
#       pdf_bytes = await asyncio.to_thread(
#           lambda: HTML(string=html_content).write_pdf()
#       )
#       return pdf_bytes
# ---------------------------------------------------------------------------


async def generate_pdf_report(data: ReportRequest) -> bytes:
    """
    Generate a PDF report for the given society analysis.

    Currently raises HTTP 501 because WeasyPrint requires GTK3 system
    dependencies that are not yet configured on this server.
    Re-enable the WeasyPrint implementation above once the dependencies
    are installed.
    """
    raise HTTPException(
        status_code=501,
        detail=(
            "PDF generation is not yet available. "
            "WeasyPrint requires GTK3 system libraries (libcairo, libpango, libgdk-pixbuf) "
            "that are not installed in the current deployment environment. "
            "Use the in-browser print-to-PDF feature in the ROI Dashboard as an alternative."
        ),
    )
