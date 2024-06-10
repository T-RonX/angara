<?php

namespace App\Game;

use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
class SendDailySalesReportsHandler
{
    public function __invoke(SendDailySalesReports $message)
    {
        $x = 1;
    }
}
