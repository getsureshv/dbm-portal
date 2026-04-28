import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { UploadsService } from '../uploads/uploads.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

@Injectable()
export class ScopePdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  /**
   * Generate a branded Scope of Work PDF from the ScopeDocument data,
   * upload it to S3, and store the key on the ScopeDocument.
   */
  async generatePdf(
    projectId: string,
    userId: string,
  ): Promise<{ downloadUrl: string; pdfS3Key: string }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        scopeDocument: true,
        owner: { select: { name: true, email: true } },
      },
    });

    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId)
      throw new ForbiddenException('Not authorized');

    const scope = project.scopeDocument;
    if (!scope) throw new NotFoundException('Scope document not found');

    // Build the PDF in memory
    const pdfBuffer = await this.buildPdf(project, scope);

    // Upload to S3
    const timestamp = Date.now();
    const s3Key = `scope-pdfs/${projectId}/${timestamp}-scope-of-work.pdf`;
    await this.uploads.putObject(s3Key, pdfBuffer, 'application/pdf');

    // Store key on ScopeDocument
    await this.prisma.scopeDocument.update({
      where: { id: scope.id },
      data: { pdfS3Key: s3Key },
    });

    return {
      downloadUrl: `/api/projects/${projectId}/scope/pdf`,
      pdfS3Key: s3Key,
    };
  }

  /**
   * Return the PDF bytes from S3 for download.
   */
  async getPdf(
    projectId: string,
    userId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { scopeDocument: true },
    });

    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId !== userId)
      throw new ForbiddenException('Not authorized');

    const scope = project.scopeDocument;
    if (!scope?.pdfS3Key) throw new NotFoundException('PDF has not been generated yet');

    const { body } = await this.uploads.getObject(scope.pdfS3Key);

    const safeTitle = project.title.replace(/[^a-zA-Z0-9-_ ]/g, '').substring(0, 50);
    const filename = `SOW-${safeTitle}.pdf`;

    return { buffer: body, filename };
  }

  // ───────────── PDF Builder ─────────────

  private async buildPdf(project: any, scope: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'LETTER',
        bufferPages: true,
        margins: { top: 60, bottom: 60, left: 60, right: 60 },
        info: {
          Title: `Scope of Work - ${project.title}`,
          Author: 'DBM Construction Portal',
          Subject: 'Scope of Work Document',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Colors ──
      const NAVY = '#0B1D3A';
      const GOLD = '#D4A843';
      const GRAY = '#4B5563';
      const LIGHT_GRAY = '#9CA3AF';
      const BG_LIGHT = '#F8FAFC';

      const PAGE_WIDTH = 612 - 120; // letter width minus margins

      // ── Header band ──
      doc.rect(0, 0, 612, 100).fill(NAVY);
      doc.fontSize(24).fillColor('#FFFFFF').text("DON'T BUILD MEH", 60, 30, { width: PAGE_WIDTH });
      doc.fontSize(10).fillColor(GOLD).text('SCOPE OF WORK', 60, 62, { width: PAGE_WIDTH });

      // ── Project title bar ──
      doc.rect(0, 100, 612, 40).fill(GOLD);
      doc.fontSize(14).fillColor(NAVY).text(project.title.toUpperCase(), 60, 112, { width: PAGE_WIDTH });

      doc.y = 160;

      // ── Meta info ──
      const meta = [
        ['Project Type', project.type?.replace(/_/g, ' ') || 'N/A'],
        ['Location (Zip)', project.zipCode || 'N/A'],
        ['Status', project.status?.replace(/_/g, ' ') || 'DISCOVERY'],
        ['Owner', project.owner?.name || 'N/A'],
        ['Generated', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
        ['Completeness', `${scope.completenessPercent ?? 0}%`],
      ];

      const metaBoxHeight = meta.length * 20 + 16;
      doc.rect(55, doc.y, PAGE_WIDTH + 10, metaBoxHeight).fill(BG_LIGHT);
      doc.rect(55, doc.y, PAGE_WIDTH + 10, metaBoxHeight).stroke('#E5E7EB');
      let metaY = doc.y + 8;
      for (const [label, value] of meta) {
        doc.fontSize(9).fillColor(LIGHT_GRAY).text(`${label}:`, 70, metaY, { width: 120 });
        doc.fontSize(9).fillColor(NAVY).text(String(value), 190, metaY, { width: PAGE_WIDTH - 140 });
        metaY += 20;
      }

      doc.y = 160 + metaBoxHeight + 20;

      // ── Scope sections ──
      const sections: Array<{ title: string; content: string | null }> = [
        { title: 'Project Scope', content: scope.projectScope },
        { title: 'Dimensions & Specifications', content: scope.dimensions },
        { title: 'Materials & Grade', content: scope.materialGrade },
        { title: 'Timeline', content: scope.timeline },
        { title: 'Milestones', content: scope.milestones },
        { title: 'Special Conditions', content: scope.specialConditions },
        { title: 'Preferred Start Date', content: scope.preferredStartDate },
        { title: 'Site Constraints', content: scope.siteConstraints },
        { title: 'Aesthetic Preferences', content: scope.aestheticPreferences },
      ];

      for (const section of sections) {
        if (!section.content) continue;

        // Check if we need a new page (leave room for title + some text)
        if (doc.y > 650) {
          doc.addPage();
          doc.y = 60;
        }

        // Gold bar accent
        const sectionY = doc.y;
        doc.rect(60, sectionY, 4, 16).fill(GOLD);
        doc.fontSize(12).fillColor(NAVY).text(section.title, 72, sectionY + 1, { width: PAGE_WIDTH - 20 });
        doc.moveDown(0.5);

        // Section body
        doc.fontSize(10).fillColor(GRAY).text(section.content, 60, doc.y, {
          width: PAGE_WIDTH,
          lineGap: 3,
          paragraphGap: 6,
        });
        doc.moveDown(1);
      }

      // ── Footer on all pages ──
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const bottom = 752 - 30;
        doc.rect(0, bottom, 612, 1).fill('#E5E7EB');
        doc
          .fontSize(7)
          .fillColor(LIGHT_GRAY)
          .text(
            `Generated by DBM Construction Portal - ${new Date().toISOString().slice(0, 10)}`,
            60,
            bottom + 6,
            { width: PAGE_WIDTH, align: 'center' },
          );
      }

      doc.end();
    });
  }
}
