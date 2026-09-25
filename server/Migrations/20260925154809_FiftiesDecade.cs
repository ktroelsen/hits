using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hits.Api.Migrations
{
    // Data-only: songs from before 1960 were filed under "60s" until the 50s decade existed.
    /// <inheritdoc />
    public partial class FiftiesDecade : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE Songs SET Decade = '50s' WHERE Year < 1960;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE Songs SET Decade = '60s' WHERE Decade = '50s';");
        }
    }
}
