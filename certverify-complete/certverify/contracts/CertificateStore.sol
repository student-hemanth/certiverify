// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title CertificateStore
 * @dev Stores certificate records on-chain: certId, studentName, courseName
 */
contract CertificateStore {

    struct Certificate {
        string certId;
        string studentName;
        string courseName;
        address issuedBy;
        uint256 issuedAt;
        bool exists;
    }

    mapping(string => Certificate) private certificates;
    string[] public allCertIds;

    event CertificateIssued(
        string indexed certId,
        string studentName,
        string courseName,
        address issuedBy,
        uint256 issuedAt
    );

    // ─── Issue ────────────────────────────────────────────────────
    function issueCertificate(
        string calldata _certId,
        string calldata _studentName,
        string calldata _courseName
    ) external {
        require(bytes(_certId).length > 0,      "certId required");
        require(bytes(_studentName).length > 0, "studentName required");
        require(bytes(_courseName).length > 0,  "courseName required");
        require(!certificates[_certId].exists,  "certId already exists");

        certificates[_certId] = Certificate({
            certId:      _certId,
            studentName: _studentName,
            courseName:  _courseName,
            issuedBy:    msg.sender,
            issuedAt:    block.timestamp,
            exists:      true
        });

        allCertIds.push(_certId);
        emit CertificateIssued(_certId, _studentName, _courseName, msg.sender, block.timestamp);
    }

    // ─── Get ──────────────────────────────────────────────────────
    function getCertificate(string calldata _certId)
        external
        view
        returns (
            string memory certId,
            string memory studentName,
            string memory courseName,
            address issuedBy,
            uint256 issuedAt,
            bool exists
        )
    {
        Certificate storage c = certificates[_certId];
        return (c.certId, c.studentName, c.courseName, c.issuedBy, c.issuedAt, c.exists);
    }

    function totalCertificates() external view returns (uint256) {
        return allCertIds.length;
    }

    function getCertIds(uint256 offset, uint256 limit)
        external view returns (string[] memory ids)
    {
        uint256 total = allCertIds.length;
        if (offset >= total) return new string[](0);
        uint256 end = offset + limit > total ? total : offset + limit;
        ids = new string[](end - offset);
        for (uint256 i = 0; i < end - offset; i++) {
            ids[i] = allCertIds[offset + i];
        }
    }
}
