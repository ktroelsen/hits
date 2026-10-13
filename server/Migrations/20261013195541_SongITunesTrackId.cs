using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hits.Api.Migrations
{
    /// <inheritdoc />
    public partial class SongITunesTrackId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "ITunesTrackId",
                table: "Songs",
                type: "INTEGER",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ITunesTrackId",
                table: "Songs");
        }
    }
}
